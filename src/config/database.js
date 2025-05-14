const mongoose = require('mongoose');

// Database connection with retry mechanism
async function connectToDatabase(uri) {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000,
      // autoReconnect is deprecated and removed
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    const retryDelayMs = 5000;
    console.log(`Retrying connection in ${retryDelayMs / 1000} seconds...`);
    setTimeout(() => connectToDatabase(uri), retryDelayMs);
  }
}

// Set up MongoDB connection event handlers
function setupMongooseEventHandlers() {
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected, attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });
}

// Handle graceful shutdown
function setupGracefulShutdown(redisCache) {
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to app termination');
    
    if (redisCache && redisCache.connected) {
      await redisCache.close();
      // Only log Redis closure here, not in the RedisCache.close() method
      console.log('Redis connection closed');
    }
    
    process.exit(0);
  });
}

module.exports = {
  connectToDatabase,
  setupMongooseEventHandlers,
  setupGracefulShutdown
};
