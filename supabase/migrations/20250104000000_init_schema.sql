-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Players table
create table if not exists players (
  id uuid default gen_random_uuid() primary key,
  name text unique not null
);

-- Decks table (dual-color Lorcana decks, slash-separated)
create table if not exists decks (
  id uuid default gen_random_uuid() primary key,
  name text unique not null
);

-- Events table
create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  created_at timestamptz default now()
);

-- Submissions table
create table if not exists submissions (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  deck_id uuid references decks(id) on delete cascade,
  created_at timestamptz default now()
);

alter table submissions
  add column if not exists event_id uuid references events(id) on delete cascade;

create unique index if not exists submissions_event_player_unique
  on submissions(event_id, player_id);
