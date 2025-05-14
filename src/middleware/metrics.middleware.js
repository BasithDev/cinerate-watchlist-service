const promBundle = require('express-prom-bundle');
const client = require('prom-client');

// Create a custom registry
const register = new client.Registry();

// Add default metrics to the registry
client.collectDefaultMetrics({ register });

// Create custom metrics
const watchlistResponseTime = new client.Histogram({
  name: 'watchlist_service_response_time',
  help: 'Response time of watchlist service operations in seconds',
  labelNames: ['operation', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register]
});

const cacheHitRatio = new client.Gauge({
  name: 'watchlist_service_cache_hit_ratio',
  help: 'Cache hit ratio for the Watchlist Service',
  registers: [register]
});

// Create the middleware
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { app: 'watchlist-service' },
  promClient: { register },
  promRegistry: register,
  metricsPath: '/metrics',
  normalizePath: [
    ['^/user/.*', '/user/:id'],
    ['^/movie/.*', '/movie/:id'],
    ['^/tv/.*', '/tv/:id']
  ]
});

module.exports = {
  metricsMiddleware,
  metrics: {
    watchlistResponseTime,
    cacheHitRatio
  }
};
