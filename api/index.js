require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Init Supabase client from env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[WARN] SUPABASE_URL / SUPABASE_KEY not set. Endpoints will fail until you add them.');
}
if (!ADMIN_PASSWORD) {
  console.warn('[WARN] ADMIN_PASSWORD not set. Admin endpoints will be unavailable.');
}
const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

const frontendHtmlPath = path.join(__dirname, '../public/index.html');
const adminHtmlPath = path.join(__dirname, '../public/admin.html');
const adminLoginHtmlPath = path.join(__dirname, '../public/admin-login.html');

function parseCsvNames(csvText) {
  const lines = (csvText || '').split(/\r?\n/);
  const names = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let value = '';
    if (line.startsWith('"')) {
      const end = line.indexOf('",');
      if (end !== -1) {
        value = line.slice(1, end).replace(/""/g, '"');
      } else if (line.endsWith('"')) {
        value = line.slice(1, -1).replace(/""/g, '"');
      } else {
        value = line.slice(1).replace(/""/g, '"');
      }
    } else {
      value = line.split(',')[0];
    }
    const cleaned = value.trim();
    if (!cleaned || cleaned.toLowerCase() === 'username') continue;
    names.push(cleaned);
  }
  return names;
}

function describeSupabaseError(error) {
  if (!error) return 'Unknown error';
  const parts = [error.message, error.details, error.hint, error.code].filter(Boolean);
  return parts.join(' | ') || 'Unknown error';
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function getAdminSessionToken() {
  if (!ADMIN_PASSWORD) return '';
  return crypto.createHmac('sha256', ADMIN_PASSWORD).update('admin_session').digest('hex');
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, pair) => {
    const [key, ...rest] = pair.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function getAdminPassword(req) {
  return (req.headers['x-admin-password'] || '').toString();
}

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin password not configured.' });
  }
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies.admin_session;
  const expectedToken = getAdminSessionToken();
  const provided = getAdminPassword(req);
  if (cookieToken === expectedToken || provided === ADMIN_PASSWORD) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// Serve the lightweight reporting UI on the root path so players have an easy entry point
app.get('/', (req, res) => {
  res.sendFile(frontendHtmlPath);
});

app.get('/admin', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.admin_session === getAdminSessionToken()) {
    return res.sendFile(adminHtmlPath);
  }
  return res.redirect('/admin/login');
});

app.get('/admin/login', (req, res) => {
  res.sendFile(adminLoginHtmlPath);
});

app.post('/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin password not configured.' });
  }
  const password = (req.body?.password || '').toString();
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = getAdminSessionToken();
  res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
  return res.json({ ok: true });
});

app.post('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'admin_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict');
  return res.json({ ok: true });
});

// Keep the previous JSON help text under a dedicated endpoint for reference
app.get('/api-info', (req, res) => {
  res.json({
    ok: true,
    name: 'Lorcana Tracker API',
    message: 'Use the endpoints below to read players/decks, submit entries, or look up the latest submission.',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health probe used by Vercel/monitors.' },
      { method: 'GET', path: '/events', description: 'List of tracked events.' },
      { method: 'GET', path: '/players', description: 'List of player names pulled from Supabase.' },
      { method: 'GET', path: '/decks', description: 'List of decks pulled from Supabase.' },
      {
        method: 'POST',
        path: '/submit',
        description: 'Record that a player is using a deck for an event. Player must already exist.',
        body: { event_id: 'event-uuid', player: 'Your Player', deck: 'Amber/Amethyst' }
      },
      {
        method: 'GET',
        path: '/lookup?event=EVENT_ID&player=NAME',
        description: 'Fetch the most recent submission for a player at an event.'
      }
    ],
    notes: [
      'Set SUPABASE_URL and SUPABASE_KEY environment variables in Vercel for data access.',
      'Set ADMIN_PASSWORD to access /admin and admin endpoints.',
      'Seed the database with supabase/setup.sql before using submit endpoints.'
    ]
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// GET /events -> [{ id, name, created_at }]
app.get('/events', async (req, res) => {
  const { data, error } = await supabase.from('events').select('id,name,created_at').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/events/:eventId/summary', async (req, res) => {
  const eventId = req.params.eventId;
  const { data, error } = await supabase.from('submissions').select('deck_id').eq('event_id', eventId);
  if (error) return res.status(500).json({ error: error.message });

  const deckIds = Array.from(new Set((data || []).map((row) => row.deck_id).filter(Boolean)));
  const { data: decks, error: dErr } = deckIds.length
    ? await supabase.from('decks').select('id,name').in('id', deckIds)
    : { data: [] };
  if (dErr) return res.status(500).json({ error: dErr.message });

  const deckMap = new Map((decks || []).map((deck) => [deck.id, deck.name]));
  const counts = new Map();
  (data || []).forEach((row) => {
    const deckName = deckMap.get(row.deck_id);
    if (!deckName) return;
    counts.set(deckName, (counts.get(deckName) || 0) + 1);
  });

  const summary = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  res.json({ total: data?.length || 0, decks: summary });
});

// GET /players?startsWith=A -> ["Nikita", "Tiana", ...]
app.get('/players', async (req, res) => {
  const startsWith = (req.query.startsWith || '').toString().trim();
  let query = supabase.from('players').select('name');
  if (startsWith) {
    query = query.ilike('name', `${startsWith}%`);
  }
  const { data, error } = await query.order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(p => p.name));
});

// GET /decks -> ["Amber/Amethyst", ...]
app.get('/decks', async (req, res) => {
  const { data, error } = await supabase.from('decks').select('name').order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(d => d.name));
});

// POST /submit { event_id, player, deck }
app.post('/submit', async (req, res) => {
  try {
    const { event_id: eventId, player, deck } = req.body || {};
    const playerName = (player || '').toString().trim();
    if (!eventId || !playerName || !deck) {
      return res.status(400).json({ error: 'Missing "event_id", "player", or "deck"' });
    }

    const { data: event, error: eventErr } = await supabase.from('events').select('id,name').eq('id', eventId).single();
    if (eventErr) return res.status(400).json({ error: 'Event not found.' });

    // Ensure player exists
    let { data: p, error: pErr } = await supabase.from('players').select('id,name').eq('name', playerName).single();
    if (pErr && pErr.code !== 'PGRST116') {
      return res.status(500).json({ error: pErr.message });
    }
    if (!p) {
      const { data: fallback, error: fallbackErr } = await supabase
        .from('players')
        .select('id,name')
        .ilike('name', playerName)
        .limit(1)
        .maybeSingle();
      if (fallbackErr) return res.status(500).json({ error: fallbackErr.message });
      if (fallback) p = fallback;
    }
    if (!p) {
      const created = await supabase.from('players').insert({ name: playerName }).select('id,name').single();
      if (created.error) return res.status(500).json({ error: created.error.message });
      p = created.data;
    }

    const { data: validation, error: validationErr } = await supabase
      .from('event_validations')
      .select('id')
      .eq('event_id', event.id)
      .maybeSingle();
    if (validationErr) return res.status(500).json({ error: validationErr.message });
    if (validation) {
      const { data: allowed, error: allowedErr } = await supabase
        .from('event_validation_players')
        .select('id')
        .eq('event_id', event.id)
        .eq('player_id', p.id)
        .maybeSingle();
      if (allowedErr) return res.status(500).json({ error: allowedErr.message });
      if (!allowed) {
        return res.status(400).json({ error: 'Player is not on the validation list for this event.' });
      }
    }

    // Require deck to already exist (from your seeded list)
    const { data: d, error: dErr } = await supabase.from('decks').select('id,name').eq('name', deck).single();
    if (dErr) return res.status(400).json({ error: `Deck not found: ${deck}` });

    const { error: sErr } = await supabase
      .from('submissions')
      .upsert(
        { event_id: event.id, player_id: p.id, deck_id: d.id, created_at: new Date().toISOString() },
        { onConflict: 'event_id,player_id' }
      );
    if (sErr) return res.status(500).json({ error: sErr.message });

    return res.json({ message: `Submission recorded for ${p.name} using ${d.name} at ${event.name}.` });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
});

// GET /lookup?event=EVENT_ID&player=NAME -> { player, deck }
app.get('/lookup', async (req, res) => {
  const eventId = (req.query.event || '').toString();
  const playerName = (req.query.player || '').toString();
  if (!eventId || !playerName) {
    return res.status(400).json({ error: 'Missing "event" or "player".' });
  }
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('id,name')
    .eq('name', playerName)
    .maybeSingle();
  if (playerErr) return res.status(500).json({ error: playerErr.message });
  if (!player) return res.status(404).json({ message: 'No information on player deck yet.' });

  const { data, error } = await supabase
    .from('submissions')
    .select('created_at, decks(name)')
    .eq('event_id', eventId)
    .eq('player_id', player.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (!data || !data.length) return res.status(404).json({ message: 'No information on player deck yet.' });

  const row = data[0];
  return res.json({ player: player.name, deck: row.decks?.name || null, created_at: row.created_at });
});

// Admin endpoints
app.get('/admin/events', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('events').select('id,name,created_at').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/admin/events', requireAdmin, async (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Event name is required.' });

  const { data, error } = await supabase.from('events').insert({ name }).select('id,name,created_at').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/admin/events/:eventId', requireAdmin, async (req, res) => {
  const eventId = req.params.eventId;
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Event name is required.' });

  const { data, error } = await supabase.from('events').update({ name }).eq('id', eventId).select('id,name').single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Event not found.' });
  res.json(data);
});

app.get('/admin/events/:eventId/entries', requireAdmin, async (req, res) => {
  const eventId = req.params.eventId;
  const { data, error } = await supabase
    .from('submissions')
    .select('id, created_at, player_id, deck_id')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const playerIds = Array.from(new Set((data || []).map((row) => row.player_id).filter(Boolean)));
  const deckIds = Array.from(new Set((data || []).map((row) => row.deck_id).filter(Boolean)));

  const [playersResp, decksResp] = await Promise.all([
    playerIds.length ? supabase.from('players').select('id,name').in('id', playerIds) : { data: [] },
    deckIds.length ? supabase.from('decks').select('id,name').in('id', deckIds) : { data: [] }
  ]);

  if (playersResp.error) return res.status(500).json({ error: playersResp.error.message });
  if (decksResp.error) return res.status(500).json({ error: decksResp.error.message });

  const playerMap = new Map((playersResp.data || []).map((player) => [player.id, player.name]));
  const deckMap = new Map((decksResp.data || []).map((deck) => [deck.id, deck.name]));

  const entries = (data || []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    player: playerMap.get(row.player_id) || '',
    deck: deckMap.get(row.deck_id) || ''
  }));
  res.json(entries);
});

app.patch('/admin/entries/:entryId', requireAdmin, async (req, res) => {
  const entryId = req.params.entryId;
  const player = (req.body?.player || '').trim();
  const deck = (req.body?.deck || '').trim();
  if (!player || !deck) return res.status(400).json({ error: 'Player and deck are required.' });

  const { data: p, error: pErr } = await supabase.from('players').select('id,name').eq('name', player).single();
  if (pErr) return res.status(400).json({ error: `Player not found: ${player}` });

  const { data: d, error: dErr } = await supabase.from('decks').select('id,name').eq('name', deck).single();
  if (dErr) return res.status(400).json({ error: `Deck not found: ${deck}` });

  const { error } = await supabase.from('submissions').update({ player_id: p.id, deck_id: d.id }).eq('id', entryId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.delete('/admin/entries/:entryId', requireAdmin, async (req, res) => {
  const entryId = req.params.entryId;
  const { error } = await supabase.from('submissions').delete().eq('id', entryId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.get('/admin/players', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('players').select('id,name').order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.patch('/admin/players/:playerId', requireAdmin, async (req, res) => {
  const playerId = req.params.playerId;
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Player name is required.' });

  const { error } = await supabase.from('players').update({ name }).eq('id', playerId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.delete('/admin/players/:playerId', requireAdmin, async (req, res) => {
  const playerId = req.params.playerId;
  const { error } = await supabase.from('players').delete().eq('id', playerId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.get('/admin/events/:eventId/validation', requireAdmin, async (req, res) => {
  const eventId = req.params.eventId;
  const { data: validation, error: validationErr } = await supabase
    .from('event_validations')
    .select('id, source_filename, created_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (validationErr) return res.status(500).json({ error: validationErr.message });
  if (!validation) return res.json({ enabled: false, count: 0 });

  const { count, error: countErr } = await supabase
    .from('event_validation_players')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (countErr) return res.status(500).json({ error: countErr.message });

  res.json({
    enabled: true,
    count: count || 0,
    source_filename: validation.source_filename,
    created_at: validation.created_at
  });
});

app.post('/admin/events/:eventId/validation/import', requireAdmin, async (req, res) => {
  const eventId = req.params.eventId;
  const filename = (req.body?.filename || '').toString().trim();
  const csvText = (req.body?.csv || '').toString();
  if (!csvText) return res.status(400).json({ error: 'CSV content is required.' });

  const names = parseCsvNames(csvText);
  if (!names.length) return res.status(400).json({ error: 'No usernames found in CSV.' });

  const uniqueNames = Array.from(new Set(names));
  const playersByName = new Map();
  for (const chunk of chunkArray(uniqueNames, 500)) {
    const { data, error } = await supabase
      .from('players')
      .upsert(
        chunk.map((name) => ({ name })),
        { onConflict: 'name' }
      )
      .select('id,name');
    if (error) {
      console.error('Validation import: player upsert failed', error);
      return res.status(500).json({ error: describeSupabaseError(error) });
    }
    (data || []).forEach((player) => {
      if (player?.name && player?.id) {
        playersByName.set(player.name, player.id);
      }
    });
  }

  const { error: clearErr } = await supabase.from('event_validation_players').delete().eq('event_id', eventId);
  if (clearErr) {
    console.error('Validation import: clear existing players failed', clearErr);
    return res.status(500).json({ error: describeSupabaseError(clearErr) });
  }

  const mappings = uniqueNames
    .map((name) => playersByName.get(name))
    .filter(Boolean)
    .map((playerId) => ({ event_id: eventId, player_id: playerId }));
  for (const chunk of chunkArray(mappings, 1000)) {
    const { error } = await supabase.from('event_validation_players').insert(chunk);
    if (error) {
      console.error('Validation import: insert mappings failed', error);
      return res.status(500).json({ error: describeSupabaseError(error) });
    }
  }

  const { error: validationErr } = await supabase
    .from('event_validations')
    .upsert({ event_id: eventId, source_filename: filename || 'validation.csv' }, { onConflict: 'event_id' });
  if (validationErr) {
    console.error('Validation import: upsert metadata failed', validationErr);
    return res.status(500).json({ error: describeSupabaseError(validationErr) });
  }

  res.json({ ok: true, count: mappings.length, filename: filename || 'validation.csv' });
});

app.delete('/admin/events/:eventId/validation', requireAdmin, async (req, res) => {
  const eventId = req.params.eventId;
  const { error: clearErr } = await supabase.from('event_validation_players').delete().eq('event_id', eventId);
  if (clearErr) return res.status(500).json({ error: clearErr.message });
  const { error: metaErr } = await supabase.from('event_validations').delete().eq('event_id', eventId);
  if (metaErr) return res.status(500).json({ error: metaErr.message });
  res.json({ ok: true });
});

// Local dev
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

module.exports = app;
