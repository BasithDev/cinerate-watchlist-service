const mongoose = require('mongoose');

const WatchlistSchema = new mongoose.Schema({
  userId: String,
  contentId: String,
  mediaType: String,
}, { timestamps: true });

const Watchlist = mongoose.model('Watchlist', WatchlistSchema);

module.exports = Watchlist;
