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

-- Submissions table
create table if not exists submissions (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references players(id) on delete cascade,
  deck_id uuid references decks(id) on delete cascade,
  created_at timestamptz default now()
);

-- Seed dual-color decks
insert into decks (name) values
  ('Amber/Amethyst'),
  ('Amber/Emerald'),
  ('Amber/Ruby'),
  ('Amber/Sapphire'),
  ('Amber/Steel'),
  ('Amethyst/Emerald'),
  ('Amethyst/Ruby'),
  ('Amethyst/Sapphire'),
  ('Amethyst/Steel'),
  ('Emerald/Ruby'),
  ('Emerald/Sapphire'),
  ('Emerald/Steel'),
  ('Ruby/Sapphire'),
  ('Ruby/Steel'),
  ('Sapphire/Steel')
on conflict (name) do nothing;
