# Supabase Lorcana Match Tracker API (Vercel)

Simple Express API deployed on Vercel that connects to Supabase (PostgreSQL).

## Endpoints
- `GET /health`
- `GET /players`
- `GET /decks`
- `POST /submit` JSON: `{ "player": "Nikita", "deck": "Amber/Amethyst" }`
- `GET /lookup/:player`

### Example usage

```bash
# Check that the API is up
curl https://tracker-lorcana.vercel.app/health

# List known players and decks
curl https://tracker-lorcana.vercel.app/players
curl https://tracker-lorcana.vercel.app/decks

# Record a submission
curl -X POST https://tracker-lorcana.vercel.app/submit \
  -H 'Content-Type: application/json' \
  -d '{"player":"Nikita","deck":"Amber/Amethyst"}'

# Look up the last deck submitted for a player
curl https://tracker-lorcana.vercel.app/lookup/Nikita
```

## Setup

1) **Create Supabase project** → copy your Project URL + Anon Key.  
2) **Create tables** (Supabase SQL Editor) using [`supabase/setup.sql`](supabase/setup.sql).  
3) **Set Vercel env vars** (`SUPABASE_URL`, `SUPABASE_KEY`).  
4) **Deploy** (GitHub → Vercel).

## Local dev
```bash
npm install
cp .env.example .env   # then fill in your keys (if using dotenv tooling)
npm run dev
```

Open http://localhost:3000/health
