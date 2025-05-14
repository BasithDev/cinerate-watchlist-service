const mongoose = require('mongoose');

class HealthController {
  async checkHealth(req, res) {
    const healthcheck = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: Date.now(),
      mongoDbConnection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redisConnection: req.redisCache && req.redisCache.connected ? 'connected' : 'disconnected'
    };

    try {
      await mongoose.connection.db.admin().ping();
      healthcheck.dbPing = 'successful';
      
      // Check Redis connection
      if (req.redisCache) {
        if (!req.redisCache.connected) {
          try {
            await req.redisCache.connect();
            healthcheck.redisPing = 'successful';
          } catch (redisError) {
            healthcheck.redisPing = 'failed';
            healthcheck.redisError = redisError.message;
          }
        } else {
          healthcheck.redisPing = 'successful';
        }
      } else {
        healthcheck.redisPing = 'not configured';
      }
      
      res.status(200).json(healthcheck);
    } catch (error) {
      healthcheck.message = error.message;
      healthcheck.dbPing = 'failed';
      res.status(503).json(healthcheck);
    }
  }

  testEndpoint(req, res) {
    res.send('Watchlist service is running');
  }
}

module.exports = new HealthController();
