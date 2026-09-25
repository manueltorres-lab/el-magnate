// Acceso a la base. La Edge Function se conecta directo a Postgres (SUPABASE_DB_URL) como
// dueña del schema `game`; la Data API no se usa. Todo el SQL va parametrizado.
import postgres from 'postgres';
import type { Action, Config, RunState } from './engine/index.ts';

export type Sql = ReturnType<typeof postgres>;

export interface RunRow {
  id: string;
  player_id: string;
  seed_code: string;
  ranked: boolean;
  status: 'active' | 'finished' | 'abandoned';
  state: RunState;
  config: Config;
  version: number;
  actions_count: number;
  flagged: boolean;
  created_at: Date;
}

export interface Finish {
  key: string;
  capital: number;
  quiebra: boolean;
}

export interface RankingRow {
  lbtag: string;
  final_key: string;
  final_capital: number;
  rareza: number;
  finished_at: Date;
  player_id: string;
}

export interface DueloRow {
  player_id: string;
  lbtag: string | null;
  status: RunRow['status'];
  final_key: string | null;
  final_capital: number | null;
  created_at: Date;
}

export interface Store {
  ensurePlayer(id: string): Promise<void>;
  rateHit(key: string, windowSeconds: number, max: number): Promise<boolean>;
  createRun(r: { playerId: string; seedCode: string; ranked: boolean; state: RunState; config: Config }): Promise<RunRow>;
  getRun(id: string, playerId: string): Promise<RunRow | null>;
  /** Escritura con control optimista. false si la versión ya no coincide (o la partida no está activa). */
  applyAction(a: {
    id: string; playerId: string; version: number; state: RunState; action: Action;
    finish: Finish | null; minSeconds: number; maxActions: number;
  }): Promise<boolean>;
  getMe(playerId: string): Promise<{ lbtag: string | null; unlocked: string[] }>;
  /** false si el tag ya es de otro jugador */
  setLbtag(playerId: string, lbtag: string): Promise<boolean>;
  ranking(by: 'rareza' | 'plata', period: 'semana' | 'historico', limit: number): Promise<RankingRow[]>;
  duelo(code: string): Promise<DueloRow[]>;
}

export function connect(url: string): Sql {
  return postgres(url, {
    max: 5,
    prepare: false, // compatible con el pooler de Supabase (modo transacción)
    idle_timeout: 20,
    // bigint → number: los montos del juego entran de sobra en un double
    types: { bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) } },
    onnotice: () => {},
  });
}

const RUN_COLS = 'id, player_id, seed_code, ranked, status, state, config, version, actions_count, flagged, created_at';

export function pgStore(sql: Sql): Store {
  return {
    async ensurePlayer(id) {
      await sql`insert into game.players (id) values (${id}) on conflict (id) do nothing`;
    },

    async rateHit(key, windowSeconds, max) {
      const [r] = await sql`select game.rate_hit(${key}, ${windowSeconds}, ${max}) as ok`;
      return r.ok as boolean;
    },

    async createRun({ playerId, seedCode, ranked, state, config }) {
      return await sql.begin(async (tx) => {
        await tx`update game.runs set status = 'abandoned' where player_id = ${playerId} and status = 'active'`;
        const [row] = await tx.unsafe(
          `insert into game.runs (player_id, seed_code, ranked, state, config)
           values ($1, $2, $3, $4::jsonb, $5::jsonb) returning ${RUN_COLS}`,
          [playerId, seedCode, ranked, JSON.stringify(state), JSON.stringify(config)],
        );
        return row as unknown as RunRow;
      }) as RunRow;
    },

    async getRun(id, playerId) {
      const rows = await sql.unsafe(`select ${RUN_COLS} from game.runs where id = $1 and player_id = $2`, [id, playerId]);
      return (rows[0] as unknown as RunRow) ?? null;
    },

    async applyAction({ id, playerId, version, state, action, finish, minSeconds, maxActions }) {
      return await sql.begin(async (tx) => {
        const rows = await tx.unsafe(
          `update game.runs set
             state = $4::jsonb,
             version = version + 1,
             actions_count = actions_count + 1,
             last_action_at = now(),
             status = case when $5::boolean then 'finished' else status end,
             finished_at = case when $5::boolean then now() else finished_at end,
             final_key = $6, final_capital = round($7::numeric)::bigint, quiebra = $8,
             flagged = flagged
               or ($5::boolean and now() - created_at < make_interval(secs => $9))
               or actions_count + 1 > $10,
             flag_reason = coalesce(flag_reason,
               case when $5::boolean and now() - created_at < make_interval(secs => $9) then 'demasiado_rapida'
                    when actions_count + 1 > $10 then 'demasiadas_acciones' end)
           where id = $1 and player_id = $2 and version = $3 and status = 'active'
           returning version`,
          [id, playerId, version, JSON.stringify(state), !!finish, finish?.key ?? null,
            finish?.capital ?? null, finish?.quiebra ?? null, minSeconds, maxActions],
        );
        if (rows.length === 0) return false;
        await tx.unsafe(`insert into game.run_actions (run_id, seq, action) values ($1, $2, $3::jsonb)`,
          [id, version + 1, JSON.stringify(action)]);
        if (finish) {
          await tx`insert into game.unlocks (player_id, final_key, first_run)
                   values (${playerId}, ${finish.key}, ${id}) on conflict do nothing`;
        }
        return true;
      }) as boolean;
    },

    async getMe(playerId) {
      const [p] = await sql`select lbtag from game.players where id = ${playerId}`;
      const u = await sql`select final_key from game.unlocks where player_id = ${playerId} order by created_at`;
      return { lbtag: (p?.lbtag as string) ?? null, unlocked: u.map((r) => r.final_key as string) };
    },

    async setLbtag(playerId, lbtag) {
      try {
        await sql`update game.players set lbtag = ${lbtag} where id = ${playerId}`;
        return true;
      } catch (e) {
        if ((e as { code?: string }).code === '23505') return false; // unique_violation
        throw e;
      }
    },

    async ranking(by, period, limit) {
      // la mejor partida de cada jugador, según el criterio del ranking
      const since = period === 'semana' ? sql`and finished_at > now() - interval '7 days'` : sql``;
      const best = by === 'rareza'
        ? sql`order by player_id, rareza asc, final_capital desc, finished_at asc`
        : sql`order by player_id, final_capital desc, finished_at asc`;
      const outer = by === 'rareza'
        ? sql`order by rareza asc, final_capital desc, finished_at asc`
        : sql`order by final_capital desc, finished_at asc`;
      const rows = await sql`
        select * from (
          select distinct on (player_id) player_id, lbtag, final_key, final_capital, rareza::float8 as rareza, finished_at
          from game.ranking_candidates where true ${since}
          ${best}
        ) b ${outer} limit ${limit}`;
      return rows as unknown as RankingRow[];
    },

    async duelo(code) {
      // solo el PRIMER intento de cada jugador con ese código
      const rows = await sql`
        select * from (
          select distinct on (r.player_id) r.player_id, p.lbtag, r.status, r.final_key, r.final_capital, r.created_at, r.flagged
          from game.runs r join game.players p on p.id = r.player_id
          where r.seed_code = ${code}
          order by r.player_id, r.created_at asc
        ) f
        order by (status = 'finished' and not flagged) desc, final_capital desc nulls last, created_at asc
        limit 100`;
      return rows as unknown as DueloRow[];
    },
  };
}
