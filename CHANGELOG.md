# Changelog

## Unreleased
- Add event-scoped tracking with admin management and updated public flow.
- Add Supabase migration workflow with initial schema migration and db push script.
- Make the initial migration idempotent for existing submissions tables.
- Add local `.env` configuration for Supabase and admin access.
- Add `.gitignore` to exclude local env files, node_modules, and Supabase state.
- Load environment variables from `.env` via dotenv for local development.
- Replace Basic Auth with a password login page and cookie session for admin access.
- Keep player autocomplete global while submissions remain event-scoped.
- Remove seeded players so new deployments start empty, and allow submissions to create players on first report.
- Restore global player autocomplete for lookup and reporting.
- Add admin player management to rename or delete global players.
- Refresh event entries after admin player updates or deletions.
