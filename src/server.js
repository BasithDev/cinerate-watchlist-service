const { app, redisCache } = require('./app');
const { connectToDatabase, setupMongooseEventHandlers, setupGracefulShutdown } = require('./config/database');

// Setup MongoDB connection event handlers
setupMongooseEventHandlers();

// Setup graceful shutdown
setupGracefulShutdown(redisCache);

// Start the server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectToDatabase(process.env.MONGO_URI || 'mongodb://mongo-svc:27017/cineRate-watchlist-db');
    
    // Connect to Redis
    try {
      await redisCache.connect();
      // Redis client will log connection via event handler
    } catch (redisError) {
      console.warn('Warning: Could not connect to Redis:', redisError.message);
      console.warn('Watchlist service will run without caching');
    }
    
    // Start the server
    const PORT = process.env.PORT || 3003;
    app.server = app.listen(PORT, () => {
      console.log(`Watchlist service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start service:', err);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
