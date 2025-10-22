# Supabase Lorcana Match Tracker API (Vercel)

Simple Express API deployed on Vercel that connects to Supabase (PostgreSQL).

## Endpoints
- `GET /health`
- `GET /players`
- `GET /decks`
- `POST /submit` JSON: `{ "player": "Nikita", "deck": "Amber/Amethyst" }`
- `GET /lookup/:player`

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
