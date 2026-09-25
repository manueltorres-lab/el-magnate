// API de El Magnate (Hono). El cliente nunca manda un número del juego: manda qué botón tocó.
// createApp recibe sus dependencias para poder probarla con una base local y auth falsa.
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import {
  cleanCode, createRun, deriveSeeds, EngineError, mkCode, step, toView,
  type Action, type Config, type RunState,
} from './engine/index.ts';
import { ApiError } from './errors.ts';
import { bearer, type Authenticator } from './auth.ts';
import type { RunRow, Store } from './store.ts';

export interface Limits {
  /** partidas nuevas por jugador por hora */
  runsPerHour: number;
  /** partidas nuevas por IP por hora */
  runsPerHourIp: number;
  /** acciones por jugador por segundo */
  actionsPerSecond: number;
  /** partidas terminadas en menos de esto quedan marcadas (fuera del ranking hasta revisión) */
  minRunSeconds: number;
  /** más acciones que esto en una partida = bot: se marca */
  maxActions: number;
}

export const DEFAULT_LIMITS: Limits = {
  runsPerHour: 30, runsPerHourIp: 120, actionsPerSecond: 5, minRunSeconds: 40, maxActions: 200,
};

export interface AppDeps {
  store: Store;
  authenticate: Authenticator;
  /** SERVER_SECRET (o la CryptoKey ya importada) */
  secret: string | CryptoKey;
  config: Config;
  allowedOrigins: string[];
  limits?: Partial<Limits>;
}

type Env = { Variables: { uid: string } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION_TYPES = new Set([
  'pick', 'continue', 'eventPick', 'quizAnswer', 'quizNext', 'quizClose', 'miniStake', 'miniSkip',
  'slotsSpin', 'ruletaSpin', 'dobleDouble', 'dobleCashout', 'sobreOpen', 'bjHit', 'bjStand', 'miniFinish',
]);
const PAYLOAD: Record<string, string | undefined> = {
  pick: 'option', eventPick: 'option', quizAnswer: 'option', miniStake: 'frac', sobreOpen: 'index',
};

/** Rearma la acción con solo los campos permitidos: nada extra del cliente llega al motor ni a la base. */
function parseAction(raw: unknown): Action {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ApiError('bad_action');
  const r = raw as Record<string, unknown>;
  if (typeof r.type !== 'string' || !ACTION_TYPES.has(r.type)) throw new ApiError('bad_action');
  const field = PAYLOAD[r.type];
  if (!field) return { type: r.type } as Action;
  const v = r[field];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ApiError('bad_action');
  return { type: r.type, [field]: v } as unknown as Action;
}

async function body(c: Context): Promise<Record<string, unknown>> {
  const text = await c.req.text();
  if (!text) return {};
  if (text.length > 4096) throw new ApiError('bad_request');
  try {
    const b = JSON.parse(text);
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error();
    return b;
  } catch {
    throw new ApiError('bad_request');
  }
}

function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  return (xff?.split(',')[0] ?? c.req.header('x-real-ip') ?? 'unknown').trim();
}

function runResponse(run: RunRow) {
  return { runId: run.id, version: run.version, status: run.status, view: toView(run.state, run.config) };
}

export function normalizeLbtag(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/^\$+/, '').toLowerCase();
  return /^[a-z0-9._]{3,20}$/.test(t) ? t : null;
}

export function createApp(deps: AppDeps) {
  const L: Limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const { store } = deps;
  const app = new Hono<Env>().basePath('/api');

  app.use('*', cors({
    origin: (origin) => (deps.allowedOrigins.includes(origin) ? origin : null),
    allowHeaders: ['authorization', 'content-type', 'apikey', 'x-client-info'],
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    maxAge: 600,
  }));

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json(err.toJSON(), err.status as 400);
    if (err instanceof EngineError) {
      const e = new ApiError(err.code === 'out_of_phase' ? 'out_of_phase' : 'bad_action');
      return c.json(e.toJSON(), e.status as 400);
    }
    // sin detalles al cliente ni datos sensibles en el log
    console.error('api error:', (err as Error)?.name, (err as Error)?.message);
    if (globalThis.process?.env?.API_DEBUG) console.error((err as Error)?.stack);
    return c.json(new ApiError('internal').toJSON(), 500);
  });
  app.notFound((c) => c.json(new ApiError('not_found', 'Esa ruta no existe.').toJSON(), 404));

  // auth en todas las rutas (el gateway de Supabase ya exige un JWT; acá se valida el usuario)
  app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') return next();
    const token = bearer(c.req.header('authorization'));
    const uid = token ? await deps.authenticate(token) : null;
    if (!uid || !UUID.test(uid)) throw new ApiError('unauthorized');
    c.set('uid', uid);
    await store.ensurePlayer(uid);
    await next();
  });

  const limit = async (key: string, windowSeconds: number, max: number) => {
    if (!(await store.rateHit(key, windowSeconds, max))) throw new ApiError('rate_limited');
  };

  app.post('/runs', async (c) => {
    const uid = c.get('uid');
    const b = await body(c);
    await limit('runs:p:' + uid, 3600, L.runsPerHour);
    await limit('runs:ip:' + clientIp(c), 3600, L.runsPerHourIp);
    let code: string;
    let duelo = false;
    if (b.duelo !== undefined && b.duelo !== null && b.duelo !== '') {
      const d = cleanCode(b.duelo);
      if (!d) throw new ApiError('bad_request', 'Ese código de duelo no es válido. Tiene la forma MGN-XXXXX.');
      code = d;
      duelo = true;
    } else {
      code = mkCode(); // lo genera el server, nunca el cliente
    }
    const cfg = deps.config;
    const seeds = await deriveSeeds(deps.secret, code, cfg.rounds);
    const state: RunState = createRun({ code, seeds, duelo }, cfg);
    let run: RunRow;
    try {
      run = await store.createRun({ playerId: uid, seedCode: code, ranked: !duelo, state, config: cfg });
    } catch (e) {
      // dos "Jugar" simultáneos chocan en one_active_run
      if ((e as { code?: string }).code === '23505') throw new ApiError('version_conflict');
      throw e;
    }
    return c.json(runResponse(run), 201);
  });

  app.get('/runs/:id', async (c) => {
    const id = c.req.param('id');
    if (!UUID.test(id)) throw new ApiError('not_found');
    const run = await store.getRun(id, c.get('uid'));
    if (!run) throw new ApiError('not_found');
    return c.json(runResponse(run));
  });

  app.post('/runs/:id/actions', async (c) => {
    const uid = c.get('uid');
    const id = c.req.param('id');
    if (!UUID.test(id)) throw new ApiError('not_found');
    const b = await body(c);
    if (typeof b.version !== 'number' || !Number.isInteger(b.version) || b.version < 0) throw new ApiError('bad_request');
    const action = parseAction(b.action);
    await limit('act:' + uid, 1, L.actionsPerSecond);

    const run = await store.getRun(id, uid);
    if (!run) throw new ApiError('not_found');
    if (run.status !== 'active') throw new ApiError('run_not_active');
    if (run.version !== b.version) throw new ApiError('version_conflict');

    const next = step(run.state, action, run.config); // EngineError → 409/400 (onError)
    const finished = next.screen === 'result';
    const ok = await store.applyAction({
      id, playerId: uid, version: run.version, state: next, action,
      finish: finished ? { key: next.titleKey!, capital: next.capital, quiebra: next.quiebra } : null,
      minSeconds: L.minRunSeconds, maxActions: L.maxActions,
    });
    if (!ok) throw new ApiError('version_conflict');
    return c.json({
      version: run.version + 1,
      status: finished ? 'finished' : 'active',
      view: toView(next, run.config),
    });
  });

  app.get('/me', async (c) => {
    const uid = c.get('uid');
    const me = await store.getMe(uid);
    return c.json({ playerId: uid, lbtag: me.lbtag, unlocked: me.unlocked });
  });

  app.put('/me/lbtag', async (c) => {
    const uid = c.get('uid');
    const b = await body(c);
    await limit('tag:' + uid, 60, 10);
    const tag = normalizeLbtag(b.lbtag);
    if (!tag) throw new ApiError('bad_request', 'El $LBtag va de 3 a 20 caracteres: letras, números, punto o guion bajo.');
    if (!(await store.setLbtag(uid, tag))) throw new ApiError('lbtag_taken');
    return c.json({ lbtag: tag });
  });

  app.get('/ranking', async (c) => {
    const by = c.req.query('by') ?? 'rareza';
    const period = c.req.query('period') ?? 'semana';
    if ((by !== 'rareza' && by !== 'plata') || (period !== 'semana' && period !== 'historico')) {
      throw new ApiError('bad_request');
    }
    const uid = c.get('uid');
    const rows = await store.ranking(by, period, 50);
    return c.json({
      by, period,
      rows: rows.map((r, i) => ({
        pos: i + 1, lbtag: r.lbtag, titleKey: r.final_key, capital: r.final_capital,
        rareza: r.rareza, mine: r.player_id === uid,
      })),
    });
  });

  app.get('/duelos/:code', async (c) => {
    const code = cleanCode(c.req.param('code'));
    if (!code) throw new ApiError('bad_request', 'Ese código de duelo no es válido.');
    const uid = c.get('uid');
    const rows = await store.duelo(code);
    return c.json({
      code,
      rows: rows.map((r) => ({
        lbtag: r.lbtag, status: r.status, mine: r.player_id === uid,
        titleKey: r.status === 'finished' ? r.final_key : null,
        capital: r.status === 'finished' ? r.final_capital : null,
      })),
    });
  });

  return app;
}
