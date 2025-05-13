const express = require('express');
const mongoose = require('mongoose');
const RedisCache = require('./redis-cache');

const app = express();
app.use(express.json());

// Initialize Redis cache
const redisCache = new RedisCache({
  prefix: 'watchlist-service:',
  ttl: 1200 // 20 minutes default TTL for watchlists
});

const WatchlistSchema = new mongoose.Schema({
  userId: String,
  contentId: String,
  mediaType: String,
}, { timestamps: true });

const Watchlist = mongoose.model('Watchlist', WatchlistSchema);

app.get('/test', (req, res) => {
  res.send('Watchlist service is running');
});

// Add a comprehensive health check endpoint
app.get('/health', async (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    mongoDbConnection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redisConnection: redisCache.connected ? 'connected' : 'disconnected'
  };

  try {
    await mongoose.connection.db.admin().ping();
    healthcheck.dbPing = 'successful';
    
    // Check Redis connection
    if (!redisCache.connected) {
      try {
        await redisCache.connect();
        healthcheck.redisPing = 'successful';
      } catch (redisError) {
        healthcheck.redisPing = 'failed';
        healthcheck.redisError = redisError.message;
      }
    } else {
      healthcheck.redisPing = 'successful';
    }
    
    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.message = error.message;
    healthcheck.dbPing = 'failed';
    res.status(503).json(healthcheck);
  }
});

// Apply cache middleware to GET routes
app.get('/:userId', redisCache.cacheMiddleware(1200), async (req, res) => {
  const watchlist = await Watchlist.find({ userId: req.params.userId });
  res.json(watchlist);
});

app.post('/add', async (req, res) => {
  const { userId, contentId } = req.body;
  const exists = await Watchlist.findOne({ userId, contentId });
  if (exists) {
    return res.status(200).json({ message: 'Content is already in the watchlist' });
  }
  const newItem = new Watchlist({ ...req.body });
  await newItem.save();
  
  // Invalidate user's watchlist cache
  if (redisCache.connected && userId) {
    try {
      await redisCache.invalidateUserWatchlistCache(userId);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
  
  res.status(201).json({ message: 'Content added to watchlist' });
});

app.post('/remove', async (req, res) => {
  const { userId, contentId } = req.body;
  await Watchlist.findOneAndDelete({ userId, contentId });
  
  // Invalidate user's watchlist cache
  if (redisCache.connected && userId) {
    try {
      await redisCache.invalidateUserWatchlistCache(userId);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
  
  res.status(201).json({ message: 'Content removed from watchlist' });
});

// ✅ Export app and connect function
async function connectToDatabase(uri) {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000,
      autoReconnect: true,
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    const retryDelayMs = 5000;
    console.log(`Retrying connection in ${retryDelayMs / 1000} seconds...`);
    setTimeout(() => connectToDatabase(uri), retryDelayMs);
  }
}

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected, attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Handle application termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to app termination');
  
  if (redisCache.connected) {
    await redisCache.close();
    console.log('Redis connection closed');
  }
  
  process.exit(0);
});

module.exports = { app, connectToDatabase };

// ✅ Start server only when run directly
if (require.main === module) {
  connectToDatabase(process.env.MONGO_URI || 'mongodb://localhost:27017/cineRate-watchlist-db').then(async () => {
    // Connect to Redis
    try {
      await redisCache.connect();
      console.log('Connected to Redis');
    } catch (redisError) {
      console.warn('Warning: Could not connect to Redis:', redisError.message);
      console.warn('Watchlist service will run without caching');
    }
    
    const PORT = process.env.PORT || 3003;
    app.listen(PORT, () => {
      console.log(`Watchlist service running on port ${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to start service:', err);
  });
}