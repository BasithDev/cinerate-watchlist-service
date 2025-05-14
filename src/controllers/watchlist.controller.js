const Watchlist = require('../models/watchlist.model');

class WatchlistController {
  // Get all watchlist items for a user
  async getUserWatchlist(req, res) {
    try {
      const watchlist = await Watchlist.find({ userId: req.params.userId });
      res.json(watchlist);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
  }

  // Add item to watchlist
  async addToWatchlist(req, res) {
    try {
      const { userId, contentId } = req.body;
      
      // Check if item already exists in watchlist
      const exists = await Watchlist.findOne({ userId, contentId });
      if (exists) {
        return res.status(200).json({ message: 'Content is already in the watchlist' });
      }
      
      // Create and save new watchlist item
      const newItem = new Watchlist({ ...req.body });
      await newItem.save();
      
      // Invalidate user's watchlist cache
      if (req.redisCache && req.redisCache.connected && userId) {
        try {
          await req.redisCache.invalidateUserWatchlistCache(userId);
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      }
      
      res.status(201).json({ message: 'Content added to watchlist' });
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      res.status(500).json({ error: 'Failed to add content to watchlist' });
    }
  }

  // Remove item from watchlist
  async removeFromWatchlist(req, res) {
    try {
      const { userId, contentId } = req.body;
      await Watchlist.findOneAndDelete({ userId, contentId });
      
      // Invalidate user's watchlist cache
      if (req.redisCache && req.redisCache.connected && userId) {
        try {
          await req.redisCache.invalidateUserWatchlistCache(userId);
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      }
      
      res.status(200).json({ message: 'Content removed from watchlist' });
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      res.status(500).json({ error: 'Failed to remove content from watchlist' });
    }
  }
}

module.exports = new WatchlistController();
