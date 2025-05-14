const express = require('express');
const createCacheMiddleware = require('./middleware/cache.middleware');
const watchlistRoutes = require('./routes/watchlist.routes');
const healthRoutes = require('./routes/health.routes');

// Create Express app
const app = express();

// Middleware
app.use(express.json());

// Initialize Redis cache middleware
const { redisCache, attachRedisCache, cacheRoute } = createCacheMiddleware();

// Attach Redis cache to request object
app.use(attachRedisCache);

// Health and test routes
app.use('/', healthRoutes);

// Watchlist routes with cache middleware
app.use('/', (req, res, next) => {
  // Apply cache middleware only to GET routes
  // Exclude health endpoints from caching
  if (req.method === 'GET' && 
      req.path.match(/^\/[^/]+$/) && 
      !req.path.startsWith('/health')) {
    return cacheRoute(1200)(req, res, next);
  }
  next();
}, watchlistRoutes);

module.exports = { app, redisCache };
