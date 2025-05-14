const express = require('express');
const watchlistController = require('../controllers/watchlist.controller');

const router = express.Router();

// Apply cache middleware from app.js before passing to these routes

// Get user's watchlist
router.get('/:userId', watchlistController.getUserWatchlist);

// Add item to watchlist
router.post('/add', watchlistController.addToWatchlist);

// Remove item from watchlist
router.post('/remove', watchlistController.removeFromWatchlist);

module.exports = router;
