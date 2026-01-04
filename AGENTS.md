# Repository Guidelines

## Project Structure & Module Organization
- `api/index.js` is the Express API entry point (Vercel serverless handler).
- `public/index.html` serves the lightweight reporting UI at `/`.
- `supabase/setup.sql` defines schema + seed data for `players`, `decks`, and `submissions`.
- `vercel.json` configures deployment routing.
- `README.md` documents endpoints and setup steps.

## Build, Test, and Development Commands
- `npm install` installs dependencies for the API.
- `npm run dev` starts the API locally on `http://localhost:3000`.
- Example request: `curl http://localhost:3000/health` to verify the server is up.

## Coding Style & Naming Conventions
- JavaScript (Node 20+), CommonJS modules (`require`, `module.exports`).
- Indentation: 2 spaces; keep route handlers small and focused.
- Endpoint paths are lowercase and hyphen-free (e.g., `/lookup/:player`).
- Use clear variable names for Supabase results (`data`, `error`, `pErr`, `dErr`).

## Testing Guidelines
- No automated test framework is configured yet.
- If you add tests, keep them close to the API (e.g., `api/__tests__/`) and document the command in `package.json`.

## Commit & Pull Request Guidelines
- Commits use short, imperative messages (e.g., "Add reporting UI", "Document API usage details").
- Keep each commit focused on a single change.
- PRs should include a concise summary, affected endpoints, and any schema changes in `supabase/setup.sql`.
- Include screenshots for UI changes in `public/index.html`.
- Update `CHANGELOG.md` for any file changes in this repository.

## Architecture Overview
- Flow: `public/index.html` (client) → Express API (`api/index.js`) → Supabase (PostgreSQL).
- The API serves the UI at `/` and exposes JSON endpoints under the same host.
- Diagram:
```
Browser UI
   |
   v
Vercel (Express API)
   |
   v
Supabase (PostgreSQL)
```

## Configuration & Security Notes
- Set `SUPABASE_URL` and `SUPABASE_KEY` (see `.env.example`).
- Do not commit secrets; use Vercel environment variables for production.
- Seed Supabase with `supabase/setup.sql` before using `/submit`.
