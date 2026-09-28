// Prueba de humo del entrypoint real (supabase/functions/api/index.ts) corriendo en Deno,
// como en Supabase: base local + un Auth falso que responde GET /auth/v1/user.
// Verifica el camino completo de auth con supabase-js, la conexión con `postgres` y CORS.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { closeDb, db, ORIGIN, SECRET } from './helpers.ts';
import { validActions, type GameView } from '../functions/_shared/engine/index.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PORT = 8000; // Deno.serve() sin opciones escucha en 8000
const BASE = `http://127.0.0.1:${PORT}/api`;

let authServer: Server;
let deno: ChildProcess;
let logs = '';
const users = new Set<string>();

before(async () => {
  const sql = db();
  // Auth falso: el token "tok-<uuid>" es de ese usuario
  authServer = createServer(async (req, res) => {
    const m = /^Bearer tok-([0-9a-f-]{36})$/.exec(req.headers.authorization ?? '');
    if (req.url?.startsWith('/auth/v1/user') && m && users.has(m[1])) {
      await sql`insert into auth.users (id) values (${m[1]}) on conflict do nothing`;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: m[1], aud: 'authenticated', role: 'authenticated', is_anonymous: true }));
    } else {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 401, msg: 'invalid JWT' }));
    }
  });
  await new Promise<void>((r) => authServer.listen(0, '127.0.0.1', r));
  const authUrl = `http://127.0.0.1:${(authServer.address() as AddressInfo).port}`;

  deno = spawn(ROOT + 'node_modules/.bin/deno', [
    'run', '--allow-net', '--allow-env', '--allow-read',
    '--config', ROOT + 'supabase/functions/api/deno.json',
    ROOT + 'supabase/functions/api/index.ts',
  ], {
    env: {
      ...process.env,
      SUPABASE_URL: authUrl,
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-falsa',
      SUPABASE_DB_URL: 'postgres://postgres@127.0.0.1:54329/magnate',
      SERVER_SECRET: SECRET,
      ALLOWED_ORIGINS: ORIGIN + ', http://localhost:5173',
      GAME_CONFIG: '{"rounds":8}',
    },
  });
  deno.stdout!.on('data', (d) => { logs += d; });
  deno.stderr!.on('data', (d) => { logs += d; });
  const t0 = Date.now();
  while (!/Listening on/i.test(logs)) {
    if (deno.exitCode !== null || Date.now() - t0 > 60000) throw new Error('Deno no arrancó:\n' + logs);
    await new Promise((r) => setTimeout(r, 100));
  }
});

after(async () => {
  deno?.kill();
  authServer?.close();
  await closeDb();
});

async function api(method: string, path: string, token: string | null, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...headers, ...(token ? { authorization: 'Bearer ' + token } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
}

test('Deno: partida completa con auth real de supabase-js y GAME_CONFIG', async () => {
  const id = randomUUID();
  users.add(id);
  const tok = 'tok-' + id;

  assert.equal((await api('GET', '/me', null)).status, 401);
  assert.equal((await api('GET', '/me', 'tok-' + randomUUID())).status, 401);

  const me = await api('GET', '/me', tok);
  assert.equal(me.status, 200);
  assert.equal(me.json.playerId, id);

  const c = await api('POST', '/runs', tok, {}, { origin: ORIGIN });
  assert.equal(c.status, 201, JSON.stringify(c.json));
  assert.equal(c.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(c.json.view.rounds, 8); // viene de GAME_CONFIG

  let { version } = c.json;
  let view: GameView = c.json.view;
  while (view.phase !== 'result') {
    // a ritmo humano: el server corta en 5 acciones por segundo por jugador
    await new Promise((r) => setTimeout(r, 220));
    const r = await api('POST', `/runs/${c.json.runId}/actions`, tok, { version, action: validActions(view)[0] });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    version = r.json.version;
    view = r.json.view;
  }
  assert.ok(view.final?.titleKey);
  const after = await api('GET', '/me', tok);
  assert.deepEqual(after.json.unlocked, [view.final!.titleKey]);
});

test('Deno: preflight CORS y origen no permitido', async () => {
  const ok = await fetch(BASE + '/runs', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  await ok.body?.cancel();
  const no = await fetch(BASE + '/runs', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
  assert.equal(no.headers.get('access-control-allow-origin'), null);
  await no.body?.cancel();
});

test('Deno: los logs no muestran secretos', () => {
  assert.ok(!logs.includes(SECRET), 'el SERVER_SECRET apareció en los logs');
  assert.ok(!logs.includes('service-role-falsa'), 'la service role key apareció en los logs');
});
