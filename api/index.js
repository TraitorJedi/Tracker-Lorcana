const express = require('express');
const cors = require('cors');

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors());

// In-memory data storage
// In a real application you would persist this data
const players = ['Alice', 'Bob', 'Charlie', 'Dana'];
const decks = ['Fire Deck', 'Water Deck', 'Earth Deck', 'Air Deck'];
const submissions = [];

/**
 * GET /players
 * Returns a list of registered player names.
 */
app.get('/players', (req, res) => {
  res.json(players);
});

/**
 * GET /decks
 * Returns a list of available deck names.
 */
app.get('/decks', (req, res) => {
  res.json(decks);
});

/**
 * POST /submit
 * Expects { player: string, deck: string } in the request body.
 * Stores the submission and returns a confirmation message.
 */
app.post('/submit', (req, res) => {
  const { player, deck } = req.body;
  if (!player || !deck) {
    return res.status(400).json({ error: 'Player and deck are required.' });
  }
  submissions.push({ player, deck, timestamp: Date.now() });
  return res.json({ message: `Submission recorded for ${player} using ${deck}.` });
});

/**
 * GET /lookup/:player
 * Looks up the most recent deck used by the specified player.
 */
app.get('/lookup/:player', (req, res) => {
  const player = req.params.player;
  // Find the last submission for this player (case-insensitive)
  const record = [...submissions].reverse().find(
    (entry) => entry.player.toLowerCase() === player.toLowerCase()
  );
  if (record) {
    return res.json({ deck: record.deck, player: record.player });
  }
  return res.status(404).json({ message: 'No information on player deck yet.' });
});

// Start the server locally if not running in a serverless environment
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Match Tracker API listening on port ${port}`);
  });
}

// Export the app for Vercel serverless function usage
module.exports = app;