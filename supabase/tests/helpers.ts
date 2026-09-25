// Utilidades para los tests de la API contra un Postgres local (scripts/pg-local.sh).
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createApp, type AppDeps } from '../functions/_shared/app.ts';
import { connect, pgStore, type Sql } from '../functions/_shared/store.ts';
import { resolveConfig } from '../functions/_shared/engine/index.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const SECRET = 'api-test-secret-no-usar-en-produccion-0123456789';
export const ORIGIN = 'https://magnate.example';

let sql: Sql | null = null;

/** Base limpia: recrea la base local y aplica shim + migraciones. */
export function db(): Sql {
  if (!sql) {
    const url = execFileSync(ROOT + 'scripts/pg-local.sh', ['reset'], { encoding: 'utf8' }).trim().split('\n').pop()!;
    sql = connect(url);
  }
  return sql;
}

export async function closeDb() {
  await sql?.end({ timeout: 1 });
  sql = null;
}

/** Auth falsa: el token "user:<uuid>" es de ese usuario (y lo da de alta en auth.users). */
export function fakeAuth(s: Sql): AppDeps['authenticate'] {
  return async (token) => {
    const m = /^user:([0-9a-f-]{36})$/.exec(token);
    if (!m) return null;
    await s`insert into auth.users (id) values (${m[1]}) on conflict do nothing`;
    return m[1];
  };
}

export function newUser(): string {
  return 'user:' + randomUUID();
}

export function makeApp(over: Partial<AppDeps> = {}) {
  const s = db();
  return createApp({
    store: pgStore(s), authenticate: fakeAuth(s), secret: SECRET, config: resolveConfig({}),
    allowedOrigins: [ORIGIN, 'http://localhost:5173'], ...over,
  });
}

export type App = ReturnType<typeof makeApp>;

export interface Res {
  status: number;
  // deno-lint-ignore no-explicit-any
  json: any;
  headers: Headers;
}

export async function call(app: App, method: string, path: string, token?: string | null, body?: unknown,
  headers: Record<string, string> = {}): Promise<Res> {
  const h: Record<string, string> = { ...headers };
  if (token) h.authorization = 'Bearer ' + token;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await app.request('/api' + path, {
    method, headers: h, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, headers: res.headers };
}
