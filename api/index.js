const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(cors());

// Init Supabase client from env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[WARN] SUPABASE_URL / SUPABASE_KEY not set. Endpoints will fail until you add them.');
}
const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// GET /players -> ["Nikita", "Tiana", ...]
app.get('/players', async (req, res) => {
  const { data, error } = await supabase.from('players').select('name').order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(p => p.name));
});

// GET /decks -> ["Amber/Amethyst", ...]
app.get('/decks', async (req, res) => {
  const { data, error } = await supabase.from('decks').select('name').order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(d => d.name));
});

// POST /submit { player, deck }
app.post('/submit', async (req, res) => {
  try {
    const { player, deck } = req.body || {};
    if (!player || !deck) return res.status(400).json({ error: 'Missing "player" or "deck"' });

    // Ensure player exists (create if missing)
    let { data: p, error: pErr } = await supabase.from('players').select('id,name').eq('name', player).single();
    if (pErr && pErr.code !== 'PGRST116') { // not "Results contain 0 rows"
      return res.status(500).json({ error: pErr.message });
    }
    if (!p) {
      const { data: insertedP, error: insPErr } = await supabase.from('players').insert({ name: player }).select('id,name').single();
      if (insPErr) return res.status(500).json({ error: insPErr.message });
      p = insertedP;
    }

    // Require deck to already exist (from your seeded list)
    const { data: d, error: dErr } = await supabase.from('decks').select('id,name').eq('name', deck).single();
    if (dErr) return res.status(400).json({ error: `Deck not found: ${deck}` });

    const { error: sErr } = await supabase.from('submissions').insert({ player_id: p.id, deck_id: d.id });
    if (sErr) return res.status(500).json({ error: sErr.message });

    return res.json({ message: `Submission recorded for ${p.name} using ${d.name}.` });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
});

// GET /lookup/:player -> { player, deck }
app.get('/lookup/:player', async (req, res) => {
  const playerName = req.params.player;
  // Latest submission joined to players & decks via PostgREST embedding (foreign keys required)
  const { data, error } = await supabase
    .from('submissions')
    .select(`created_at, players(name), decks(name)`)
    .eq('players.name', playerName)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (!data || !data.length) return res.status(404).json({ message: 'No information on player deck yet.' });

  const row = data[0];
  return res.json({ player: row.players?.name || playerName, deck: row.decks?.name || null, created_at: row.created_at });
});

// Local dev
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

module.exports = app;
