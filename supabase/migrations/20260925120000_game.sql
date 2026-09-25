-- El Magnate: esquema del juego.
-- Todo vive en el schema `game`, que NO se expone por la Data API (PostgREST).
-- RLS activado en todas las tablas y sin policies, más revoke a anon/authenticated:
-- con la clave pública no se puede leer ni escribir nada. Solo la Edge Function `api`
-- accede, conectándose directo a Postgres (SUPABASE_DB_URL).

create schema if not exists game;
revoke all on schema game from public, anon, authenticated;

create table game.players (
  id uuid primary key references auth.users(id) on delete cascade,
  lbtag text unique check (lbtag ~ '^[a-z0-9._]{3,20}$'),
  created_at timestamptz not null default now()
);

create table game.runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references game.players(id) on delete cascade,
  seed_code text not null check (seed_code ~ '^MGN-[A-Z0-9]{5}$'),
  ranked boolean not null,
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  state jsonb not null,
  -- config del servidor con la que arrancó la partida (GAME_CONFIG puede cambiar después)
  config jsonb not null,
  version int not null default 0,
  final_key text,
  final_capital bigint,
  quiebra boolean,
  actions_count int not null default 0,
  flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now(),
  last_action_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index one_active_run on game.runs (player_id) where status = 'active';
create index runs_duelo on game.runs (seed_code, player_id, created_at);
create index runs_rank on game.runs (final_key, final_capital desc)
  where status = 'finished' and ranked and not flagged;
create index runs_stale on game.runs (last_action_at) where status = 'active';

create table game.run_actions (
  run_id uuid references game.runs(id) on delete cascade,
  seq int,
  action jsonb not null,
  created_at timestamptz not null default now(),
  primary key (run_id, seq)
);

create table game.unlocks (
  player_id uuid references game.players(id) on delete cascade,
  final_key text,
  first_run uuid references game.runs(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (player_id, final_key)
);

create table game.rareza (
  final_key text primary key,
  pct numeric not null,
  sample int not null default 0,
  updated_at timestamptz not null default now()
);

-- valores simulados de RAREZA del motor (engine/data.ts); el job diario los reemplaza con
-- datos reales cuando hay muestra suficiente (Fase 4)
insert into game.rareza (final_key, pct) values
  ('servido', 0.1),
  ('insomne', 0.3),
  ('imperio', 0.7),
  ('zafando', 0.9),
  ('perdido', 0.9),
  ('quiebra', 1.3),
  ('generoso', 2.8),
  ('pulso', 3.2),
  ('equilibrista', 3.9),
  ('disfruton', 4.4),
  ('ladrillo', 6),
  ('magnate', 7.1),
  ('emprendedor', 7.4),
  ('estudioso', 7.7),
  ('deberes', 8.3),
  ('temerario', 9.4),
  ('constructor', 9.4),
  ('referente', 13),
  ('independencia', 13.3);

-- Rate limit por ventana fija: devuelve true si todavía hay cupo.
create table game.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);

create function game.rate_hit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into game.rate_limits as r (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  -- limpieza oportunista de ventanas viejas
  if random() < 0.01 then
    delete from game.rate_limits where window_start < now() - interval '2 hours';
  end if;
  return n <= p_max;
end;
$$;

-- Partidas activas sin acciones por 24 h → abandonadas. (Fase 4: agendar con pg_cron.)
create function game.abandon_stale_runs()
returns int
language sql
set search_path = ''
as $$
  with u as (
    update game.runs set status = 'abandoned'
    where status = 'active' and last_action_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::int from u;
$$;

-- Candidatas al ranking: terminadas en el servidor, sin duelo, sin flag y con $LBtag.
create view game.ranking_candidates as
  select r.id as run_id, r.player_id, p.lbtag, r.final_key, r.final_capital, r.finished_at,
         coalesce(z.pct, 100) as rareza
  from game.runs r
  join game.players p on p.id = r.player_id
  left join game.rareza z on z.final_key = r.final_key
  where r.status = 'finished' and r.ranked and not r.flagged and p.lbtag is not null;

-- RLS sin policies + revoke: la clave pública no ve nada.
alter table game.players      enable row level security;
alter table game.runs         enable row level security;
alter table game.run_actions  enable row level security;
alter table game.unlocks      enable row level security;
alter table game.rareza       enable row level security;
alter table game.rate_limits  enable row level security;
revoke all on all tables in schema game from public, anon, authenticated;
revoke all on all functions in schema game from public, anon, authenticated;
revoke all on all sequences in schema game from public, anon, authenticated;
alter default privileges in schema game revoke all on tables from public, anon, authenticated;
alter default privileges in schema game revoke all on functions from public, anon, authenticated;
