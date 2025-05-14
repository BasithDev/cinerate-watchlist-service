const RedisCache = require('../utils/redis-cache');

// Create and initialize Redis cache middleware
function createCacheMiddleware() {
  const redisCache = new RedisCache({
    prefix: 'watchlist-service:',
    ttl: 1200 // 20 minutes default TTL for watchlists
  });

  // Middleware to attach Redis cache to request object
  return {
    redisCache,
    
    // Attach Redis cache to request object
    attachRedisCache: (req, res, next) => {
      req.redisCache = redisCache;
      next();
    },
    
    // Cache middleware for routes
    cacheRoute: (ttl) => redisCache.cacheMiddleware(ttl)
  };
}

module.exports = createCacheMiddleware;
