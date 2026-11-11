-- Matches: one row per completed match, written by the player who played it.
-- docs/DESIGN.md section 9.1.

create table public.matches (
  id                 uuid primary key default gen_random_uuid(),
  player_id          uuid not null references public.profiles (id) on delete cascade,
  opponent_type      text not null check (opponent_type in ('bot', 'human')),
  bot_difficulty     text check (bot_difficulty in ('easy', 'medium', 'hard')),
  opponent_id        uuid references public.profiles (id),
  result             text not null check (result in ('win', 'loss', 'draw')),
  end_reason         text not null check (end_reason in ('ko', 'timeout', 'forfeit')),
  input_mode         text not null check (input_mode in ('webcam', 'keyboard')),
  duration_seconds   integer not null check (duration_seconds >= 0),
  player_hp_left     integer not null,
  opponent_hp_left   integer not null,
  damage_dealt       integer not null default 0,
  damage_taken       integer not null default 0,
  jutsus_used        jsonb not null default '{}'::jsonb,
  balance_version    text not null default '1',
  created_at         timestamptz not null default now(),
  constraint bot_has_difficulty check (opponent_type <> 'bot' or bot_difficulty is not null)
);

comment on column public.matches.jutsus_used is 'Counts by jutsu id, e.g. {"fire_short": 2, "substitution": 1}.';
comment on column public.matches.balance_version is 'Which tuning the match was played under, so history stays interpretable.';

create index matches_player_created_idx on public.matches (player_id, created_at desc);

alter table public.matches enable row level security;

create policy "matches: own rows"
  on public.matches
  for all
  to authenticated
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);
