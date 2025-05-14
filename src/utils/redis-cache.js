const { createClient } = require('redis');
const CircuitBreaker = require('opossum');
const retry = require('async-retry');

class RedisCache {
  constructor(options = {}) {
    this.ttl = options.ttl || 3600; // Default TTL: 1 hour
    this.prefix = options.prefix || 'watchlist-service:';
    this.client = null;
    this.connected = false;
    this.circuitBreaker = null;
    this.redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    this.testMode = process.env.NODE_ENV === 'test';
    this.retryCount = options.retryCount || 5;
    this.retryDelay = options.retryDelay || 1000; // 1 second initial delay
    
    // Initialize circuit breaker for Redis operations
    this.initCircuitBreaker();
  }

  async connect() {
    if (this.connected) return;
    
    // Skip actual Redis connection in test mode
    if (this.testMode) {
      console.log('Running in test mode - skipping Redis connection');
      return;
    }

    try {
      await retry(async (bail, attempt) => {
        try {
          console.log(`Redis connection attempt ${attempt}/${this.retryCount}...`);
          
          this.client = createClient({
            url: this.redisUrl,
            socket: {
              reconnectStrategy: (retries) => {
                // Exponential backoff with a max of 10 seconds
                const delay = Math.min(Math.pow(2, retries) * 100, 10000);
                console.log(`Redis reconnect strategy: retry in ${delay}ms`);
                return delay;
              }
            }
          });

          // Set up event handlers
          this.client.on('error', (err) => {
            console.error('Redis error:', err);
            // Don't set connected to false here as the client will try to reconnect
          });

          this.client.on('connect', () => {
            console.log('Connected to Redis');
            this.connected = true;
          });

          this.client.on('reconnecting', () => {
            console.log('Reconnecting to Redis...');
          });
          
          this.client.on('end', () => {
            console.log('Redis connection closed');
            this.connected = false;
          });

          // Connect to Redis (the 'connect' event will log the success)
          await this.client.connect();
          this.connected = true;

          // Promisify Redis methods
          this.getAsync = this.client.get.bind(this.client);
          this.setAsync = this.client.set.bind(this.client);
          this.delAsync = this.client.del.bind(this.client);
          this.expireAsync = this.client.expire.bind(this.client);
          this.flushAsync = this.client.flushAll.bind(this.client);
          
          // If we get here, connection was successful
          return true;
        } catch (err) {
          console.error(`Redis connection attempt ${attempt} failed:`, err);
          
          // If we've reached max retries, bail out
          if (attempt >= this.retryCount) {
            console.error(`Max Redis connection retries (${this.retryCount}) reached, giving up`);
            bail(err);
            return;
          }
          
          // Otherwise, throw to trigger retry
          throw err;
        }
      }, {
        retries: this.retryCount,
        minTimeout: this.retryDelay,
        factor: 2,
        onRetry: (err, attempt) => {
          console.log(`Retrying Redis connection (${attempt}/${this.retryCount}) after error:`, err.message);
        }
      });
    } catch (error) {
      console.error('All Redis connection attempts failed:', error);
      this.connected = false;
      // Don't throw, allow the application to continue without Redis
      // The circuit breaker will handle Redis operations
    }
  }

  initCircuitBreaker() {
    const options = {
      failureThreshold: 3,           // Number of failures before opening circuit
      resetTimeout: 30000,          // Time to wait before trying again (30 seconds)
      timeout: 5000,                // Time to wait before timing out a request (5 seconds)
      errorThresholdPercentage: 50, // Percentage of failures before opening circuit
      rollingCountTimeout: 60000,   // Time window for error rate calculation (1 minute)
      rollingCountBuckets: 10,      // Number of buckets for error rate calculation
      capacity: 10                  // Maximum number of concurrent requests
    };

    this.circuitBreaker = new CircuitBreaker(async (operation) => {
      // If not connected, try to connect with retry logic
      if (!this.connected && !this.testMode) {
        try {
          await this.connect();
        } catch (err) {
          console.error('Failed to connect to Redis in circuit breaker:', err);
          // Continue even if connection fails - the operation will handle null client
        }
      }
      return await operation();
    }, options);

    this.circuitBreaker.on('open', () => {
      console.log('Redis circuit breaker opened - Redis operations will fail fast');
      // Could trigger an alert or metric here
    });

    this.circuitBreaker.on('close', () => {
      console.log('Redis circuit breaker closed - Redis operations back to normal');
    });

    this.circuitBreaker.on('halfOpen', () => {
      console.log('Redis circuit breaker half-open - testing if Redis is available');
    });
    
    this.circuitBreaker.on('reject', () => {
      console.log('Redis circuit breaker rejected a request due to open state');
    });
    
    this.circuitBreaker.on('timeout', () => {
      console.log('Redis operation timed out');
    });

    // Define fallback behavior for when the circuit is open
    this.circuitBreaker.fallback((err) => {
      console.log(`Redis fallback triggered: ${err?.message || 'Unknown error'}`);
      return null; // Return null when Redis is unavailable
    });
  }

  getKey(key) {
    return `${this.prefix}${key}`;
  }

  async get(key) {
    if (this.testMode) return null;
    
    return this.circuitBreaker.fire(async () => {
      if (!this.connected || !this.client) return null;
      
      const value = await this.getAsync(this.getKey(key));
      if (value) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value; // Return as-is if not JSON
        }
      }
      return null;
    });
  }

  async set(key, value, ttl = this.ttl) {
    if (this.testMode) return 'OK';
    
    return this.circuitBreaker.fire(async () => {
      if (!this.connected || !this.client) return 'OK';
      
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
      return await this.setAsync(this.getKey(key), stringValue, {
        EX: ttl
      });
    });
  }

  async del(key) {
    if (this.testMode) return 1;
    
    return this.circuitBreaker.fire(async () => {
      if (!this.connected || !this.client) return 1;
      
      return await this.delAsync(this.getKey(key));
    });
  }

  async flush() {
    if (this.testMode) return 'OK';
    
    return this.circuitBreaker.fire(async () => {
      if (!this.connected || !this.client) return 'OK';
      
      return await this.flushAsync();
    });
  }

  async close() {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
      // Let the shutdown handler log the closure
    }
  }

  // Cache middleware for Express routes
  cacheMiddleware(ttl = this.ttl) {
    return async (req, res, next) => {
      // Skip caching for non-GET requests or in test mode
      if (req.method !== 'GET' || this.testMode) {
        return next();
      }

      // Watchlists are user-specific, so include user ID in the cache key
      const userId = req.user?.id || req.query.userId || 'anonymous';
      const key = `user:${userId}:${req.originalUrl}`;
      
      try {
        const cachedData = await this.get(key);
        
        if (cachedData) {
          console.log(`Cache hit for ${key}`);
          res.setHeader('X-Cache', 'HIT');
          return res.json(cachedData);
        }

        console.log(`Cache miss for ${key}`);
        res.setHeader('X-Cache', 'MISS');

        // Store original res.json method
        const originalJson = res.json;

        // Override res.json method to cache the response
        res.json = async (data) => {
          // Cache the response data
          await this.set(key, data, ttl);
          
          // Call the original json method
          return originalJson.call(res, data);
        };

        next();
      } catch (error) {
        console.error('Cache middleware error:', error);
        next(); // Continue without caching on error
      }
    };
  }

  // Helper to invalidate cache by pattern
  async invalidateByPattern(pattern) {
    if (this.testMode) return 0;
    
    return this.circuitBreaker.fire(async () => {
      if (!this.connected || !this.client) return 0;
      
      const keys = await this.client.keys(`${this.prefix}${pattern}`);
      if (keys.length > 0) {
        return await this.client.del(keys);
      }
      return 0;
    });
  }

  // Helper to invalidate user's watchlist cache
  async invalidateUserWatchlistCache(userId) {
    if (this.testMode) return 0;
    return this.invalidateByPattern(`user:${userId}:*`);
  }
}

module.exports = RedisCache;
