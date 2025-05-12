const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const WatchlistSchema = new mongoose.Schema({
  userId: String,
  contentId: String,
  mediaType: String,
}, { timestamps: true });

const Watchlist = mongoose.model('Watchlist', WatchlistSchema);

app.get('/test', (req, res) => {
  res.send('Watchlist service is running');
});

app.get('/:userId', async (req, res) => {
  const watchlist = await Watchlist.find({ userId: req.params.userId });
  res.json(watchlist);
});

app.post('/add', async (req, res) => {
  const { userId, contentId } = req.body;
  const exists = await Watchlist.findOne({ userId, contentId });
  if (exists) {
    return res.status(200).json({ message: 'Content is already in the watchlist' });
  }
  const newItem = new Watchlist({ ...req.body });
  await newItem.save();
  res.status(201).json({ message: 'Content added to watchlist' });
});

app.post('/remove', async (req, res) => {
  const { userId, contentId } = req.body;
  await Watchlist.findOneAndDelete({ userId, contentId });
  res.status(201).json({ message: 'Content removed from watchlist' });
});

// ✅ Export app and connect function
async function connectToDatabase(uri) {
  await mongoose.connect(uri);
}

module.exports = { app, connectToDatabase };

// ✅ Start server only when run directly
if (require.main === module) {
  connectToDatabase(process.env.MONGO_URI || 'mongodb://localhost:27017/cineRate-watchlist-db').then(() => {
    const PORT = process.env.PORT || 3003;
    app.listen(PORT, () => {
      console.log(`Watchlist service running on port ${PORT}`);
    });
  });
}