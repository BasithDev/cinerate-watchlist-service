const Watchlist = require('../models/watchlist.model');

class WatchlistController {
  // Get all watchlist items for a user
  async getUserWatchlist(req, res) {
    try {
      const userId = req.params.userId;
      
      console.log(`Fetching watchlist for userId: ${userId}, type: ${typeof userId}`);
      console.log(`Request headers:`, req.headers);
      console.log(`Request path: ${req.path}, method: ${req.method}`);
      
      // Set cache-control headers to prevent caching
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Ensure userId is treated as string to match how it's stored in MongoDB
      const watchlist = await Watchlist.find({ userId: String(userId) });
      
      console.log(`Found ${watchlist.length} items in watchlist for user ${userId}`);
      if (watchlist.length > 0) {
        console.log('First item:', JSON.stringify(watchlist[0]));
      }
      
      // Return the watchlist with a timestamp to help identify freshness
      res.json({
        watchlist,
        timestamp: new Date().toISOString()
      });
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
          console.log(`Cache invalidated for user ${userId} after adding item ${contentId}`);
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      }
      
      // Get the updated watchlist to return in the response
      const updatedWatchlist = await Watchlist.find({ userId });
      
      // Set cache-control headers to prevent caching
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Return the updated watchlist along with the success message
      res.status(201).json({
        message: 'Content added to watchlist',
        watchlist: updatedWatchlist,
        timestamp: new Date().toISOString()
      });
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
          console.log(`Cache invalidated for user ${userId} after removing item ${contentId}`);
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      }
      
      // Get the updated watchlist to return in the response
      const updatedWatchlist = await Watchlist.find({ userId });
      
      // Set cache-control headers to prevent caching
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Return the updated watchlist along with the success message
      res.status(200).json({
        message: 'Content removed from watchlist',
        watchlist: updatedWatchlist,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      res.status(500).json({ error: 'Failed to remove content from watchlist' });
    }
  }
}

module.exports = new WatchlistController();
