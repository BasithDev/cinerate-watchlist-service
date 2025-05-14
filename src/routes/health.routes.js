const express = require('express');
const healthController = require('../controllers/health.controller');

const router = express.Router();

// Health check endpoint
router.get('/health', healthController.checkHealth);

// Test endpoint
router.get('/test', healthController.testEndpoint);

module.exports = router;
