// Tests de integración de la API (Fase 2): Hono + Postgres local con la migración real.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../functions/_shared/engine/index.ts';
import { call, closeDb, db, makeApp, newUser, ORIGIN, SECRET, type App } from './helpers.ts';

/** Claves que nunca pueden salir en una respuesta (§5). */
const NEVER = new Set([
  'order', 'bigUsed', 'showRound', 'showDone', 'rngState', 'seeds', 'serverSalt', 'miniBag', 'tagCounts',
  'riskCounts', 'finalReels', 'pool', 'min', 'max', 'pending', 'state', 'config', 'seed_code', 'player_id',
]);

function assertNoLeaks(x: unknown, where: string) {
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((y, i) => walk(y, path + '[' + i + ']'));
    else if (v && typeof v === 'object') {
      for (const [k, y] of Object.entries(v)) {
        assert.ok(!NEVER.has(k), `${where}: la respuesta incluye "${k}" en ${path}`);
        walk(y, path + '.' + k);
      }
    }
  };
  walk(x, '$');
}

/** Juega una partida completa por HTTP eligiendo acciones con `choose`. */
async function playOut(app: App, token: string, runId: string, version: number, view: E.GameView,
  choose: (acts: E.Action[]) => E.Action = (a) => a[0]) {
  let n = 0;
  while (view.phase !== 'result') {
    const r = await call(app, 'POST', `/runs/${runId}/actions`, token, { version, action: choose(E.validActions(view)) });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assertNoLeaks(r.json, 'acción');
    assert.equal(r.json.version, version + 1);
    version = r.json.version;
    view = r.json.view;
    assert.ok(++n < 300);
  }
  return { version, view };
}

let app: App;
before(() => { app = makeApp({ limits: { actionsPerSecond: 10000, minRunSeconds: 0 } }); });
after(closeDb);

describe('auth', () => {
  test('sin token o con token inválido → 401', async () => {
    for (const t of [null, 'basura', 'user:no-es-uuid']) {
      const r = await call(app, 'GET', '/me', t);
      assert.equal(r.status, 401);
      assert.equal(r.json.error.code, 'unauthorized');
      assert.ok(r.json.error.message.length > 0);
    }
  });
  test('GET /me de un jugador nuevo', async () => {
    const t = newUser();
    const r = await call(app, 'GET', '/me', t);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { playerId: t.slice(5), lbtag: null, unlocked: [] });
  });
  test('un playerId en el body se ignora', async () => {
    const t = newUser(), other = newUser();
    const r = await call(app, 'POST', '/runs', t, { playerId: other.slice(5) });
    assert.equal(r.status, 201);
    assert.equal((await call(app, 'GET', '/runs/' + r.json.runId, other)).status, 404);
    assert.equal((await call(app, 'GET', '/runs/' + r.json.runId, t)).status, 200);
  });
});

describe('partidas', () => {
  test('partida completa por HTTP, sin fugas, y se puede reproducir desde run_actions', async () => {
    const t = newUser();
    const c = await call(app, 'POST', '/runs', t, {});
    assert.equal(c.status, 201);
    assertNoLeaks(c.json, 'crear');
    assert.equal(c.json.version, 0);
    assert.equal(c.json.view.phase, 'choose');
    let k = 1;
    const { version, view } = await playOut(app, t, c.json.runId, 0, c.json.view,
      (a) => a[(k = (k * 7 + 3) % 11) % a.length]);
    assert.equal(view.screen, 'result');
    assert.ok(view.final!.titleKey);

    // recargar la página: GET devuelve lo mismo
    const g = await call(app, 'GET', '/runs/' + c.json.runId, t);
    assert.equal(g.status, 200);
    assert.equal(g.json.status, 'finished');
    assert.equal(g.json.version, version);
    assert.deepEqual(g.json.view, view);

    // la colección se escribe desde el server
    const me = await call(app, 'GET', '/me', t);
    assert.deepEqual(me.json.unlocked, [view.final!.titleKey]);

    // run_actions permite reproducir la partida desde la semilla
    const s = db();
    const [run] = await s`select seed_code, state, final_key, final_capital, actions_count from game.runs where id = ${c.json.runId}`;
    const acts = await s`select action from game.run_actions where run_id = ${c.json.runId} order by seq`;
    assert.equal(acts.length, version);
    assert.equal(run.actions_count, version);
    let st = E.createRun({ code: run.seed_code, seeds: await E.deriveSeeds(SECRET, run.seed_code, 12) });
    for (const a of acts) st = E.step(st, a.action);
    // jsonb reordena las claves: se compara el contenido, no el texto
    assert.deepStrictEqual(run.state, JSON.parse(JSON.stringify(st)));
    assert.equal(run.final_key, st.titleKey);
    assert.equal(run.final_capital, Math.round(st.capital));
    // y terminada no acepta más acciones
    const late = await call(app, 'POST', `/runs/${c.json.runId}/actions`, t, { version, action: { type: 'continue' } });
    assert.equal(late.status, 409);
    assert.equal(late.json.error.code, 'run_not_active');
  });

  test('doble envío con la misma versión → 409 y el estado no cambia', async () => {
    const t = newUser();
    const c = await call(app, 'POST', '/runs', t, {});
    const body = { version: 0, action: { type: 'pick', option: 0 } };
    const a = await call(app, 'POST', `/runs/${c.json.runId}/actions`, t, body);
    const b = await call(app, 'POST', `/runs/${c.json.runId}/actions`, t, body);
    assert.equal(a.status, 200);
    assert.equal(b.status, 409);
    assert.equal(b.json.error.code, 'version_conflict');
    const g = await call(app, 'GET', '/runs/' + c.json.runId, t);
    assert.equal(g.json.version, 1);
    assert.deepEqual(g.json.view, a.json.view);
  });

  test('dos pestañas a la vez: exactamente una gana', async () => {
    const t = newUser();
    const c = await call(app, 'POST', '/runs', t, {});
    const rs = await Promise.all([0, 1, 2, 3, 4].map((o) =>
      call(app, 'POST', `/runs/${c.json.runId}/actions`, t, { version: 0, action: { type: 'pick', option: o % 2 } })));
    assert.equal(rs.filter((r) => r.status === 200).length, 1);
    assert.ok(rs.filter((r) => r.status !== 200).every((r) => r.status === 409));
    const [{ n }] = await db()`select count(*)::int as n from game.run_actions where run_id = ${c.json.runId}`;
    assert.equal(n, 1);
  });

  test('acción fuera de fase → 409 y la versión no avanza', async () => {
    const t = newUser();
    const c = await call(app, 'POST', '/runs', t, {});
    for (const action of [{ type: 'continue' }, { type: 'bjHit' }, { type: 'quizAnswer', option: 0 }, { type: 'miniFinish' }]) {
      const r = await call(app, 'POST', `/runs/${c.json.runId}/actions`, t, { version: 0, action });
      assert.equal(r.status, 409, JSON.stringify(action));
      assert.equal(r.json.error.code, 'out_of_phase');
    }
    assert.equal((await call(app, 'GET', '/runs/' + c.json.runId, t)).json.version, 0);
  });

  test('acciones y bodies inválidos → 400', async () => {
    const t = newUser();
    const c = await call(app, 'POST', '/runs', t, {});
    const url = `/runs/${c.json.runId}/actions`;
    const bad: unknown[] = [
      { version: 0 }, { version: 0, action: { type: 'hackear' } }, { version: 0, action: { type: 'pick' } },
      { version: 0, action: { type: 'pick', option: '1' } }, { version: 0, action: { type: 'pick', option: 9 } },
      { version: 0, action: { type: 'miniStake', frac: 0.5 } }, { version: '0', action: { type: 'continue' } },
      { action: { type: 'continue' } }, [1, 2],
    ];
    for (const b of bad) {
      const r = await call(app, 'POST', url, t, b);
      assert.ok(r.status === 400 || r.status === 409, JSON.stringify(b) + ' → ' + r.status);
    }
    const raw = await app.request('/api' + url, { method: 'POST', headers: { authorization: 'Bearer ' + t }, body: '{no json' });
    assert.equal(raw.status, 400);
  });

  test('los campos extra de la acción no llegan a la base', async () => {
    const t = newUser();
    const c = await call(app, 'POST', '/runs', t, {});
    const r = await call(app, 'POST', `/runs/${c.json.runId}/actions`, t,
      { version: 0, action: { type: 'pick', option: 0, capital: 1e12, rep: 100 } });
    assert.equal(r.status, 200);
    const [a] = await db()`select action from game.run_actions where run_id = ${c.json.runId}`;
    assert.deepEqual(a.action, { type: 'pick', option: 0 });
  });

  test('partida ajena → 404, id mal formado → 404', async () => {
    const t = newUser(), otro = newUser();
    const c = await call(app, 'POST', '/runs', t, {});
    assert.equal((await call(app, 'GET', '/runs/' + c.json.runId, otro)).status, 404);
    const r = await call(app, 'POST', `/runs/${c.json.runId}/actions`, otro, { version: 0, action: { type: 'pick', option: 0 } });
    assert.equal(r.status, 404);
    assert.equal((await call(app, 'GET', "/runs/1' or '1'='1", t)).status, 404);
    assert.equal((await call(app, 'GET', '/runs/' + crypto.randomUUID(), t)).status, 404);
  });

  test('una sola partida activa: la nueva abandona la anterior', async () => {
    const t = newUser();
    const a = await call(app, 'POST', '/runs', t, {});
    const b = await call(app, 'POST', '/runs', t, {});
    assert.notEqual(a.json.runId, b.json.runId);
    assert.equal((await call(app, 'GET', '/runs/' + a.json.runId, t)).json.status, 'abandoned');
    const r = await call(app, 'POST', `/runs/${a.json.runId}/actions`, t, { version: 0, action: { type: 'pick', option: 0 } });
    assert.equal(r.json.error.code, 'run_not_active');
  });
});

describe('duelos', () => {
  test('mismo código: mismos escenarios y, con las mismas decisiones, mismo resultado', async () => {
    const p1 = newUser(), p2 = newUser();
    const a = await call(app, 'POST', '/runs', p1, {});
    const ra = await playOut(app, p1, a.json.runId, 0, a.json.view);
    const code = ra.view.challenge;
    const b = await call(app, 'POST', '/runs', p2, { duelo: code.toLowerCase() });
    assert.equal(b.status, 201);
    assert.equal(b.json.view.duelo, true);
    assert.deepEqual({ ...b.json.view, duelo: false }, a.json.view);
    const rb = await playOut(app, p2, b.json.runId, 0, b.json.view);
    assert.deepEqual({ ...rb.view, duelo: false }, ra.view);

    // p2 vuelve a entrar con el link: no hay partida nueva, le devuelve su intento y la tabla
    const b2 = await call(app, 'POST', '/runs', p2, { duelo: code });
    assert.equal(b2.status, 200);
    assert.equal(b2.json.alreadyPlayed, true);
    assert.equal(b2.json.runId, b.json.runId);
    assert.equal(b2.json.status, 'finished');
    assert.equal(b2.json.duelo.code, code);
    // el creador también: su partida (rankeada) cuenta como su intento
    const a2 = await call(app, 'POST', '/runs', p1, { duelo: code });
    assert.equal(a2.json.alreadyPlayed, true);
    assert.equal(a2.json.runId, a.json.runId);

    const d = await call(app, 'GET', '/duelos/' + code, p1);
    assert.equal(d.status, 200);
    assert.equal(d.json.rows.length, 2);
    const mine = d.json.rows.find((r: { mine: boolean }) => r.mine);
    const theirs = d.json.rows.find((r: { mine: boolean }) => !r.mine);
    assert.equal(mine.amount, E.fmt(ra.view.final!.capital));
    assert.equal(theirs.amount, E.fmt(rb.view.final!.capital));
    assert.equal(mine.title, E.TITLES[ra.view.final!.titleKey].title);
    assert.equal(mine.icon, E.TITLES[ra.view.final!.titleKey].icon);
    assert.deepEqual(d.json.rows.map((r: { pos: number }) => r.pos), [1, 2]);
    assert.deepEqual(Object.keys(mine).sort(), ['amount', 'icon', 'mine', 'pos', 'status', 'tag', 'title']);
    assert.equal(mine.tag, null);
    assertNoLeaks(d.json, 'duelo');
  });

  test('duelo: solo lo ve quien lo jugó; orden terminados → jugando → abandonados; el abandonado se retoma', async () => {
    const creador = newUser(), jugando = newUser(), abandona = newUser(), curioso = newUser();
    await call(app, 'PUT', '/me/lbtag', creador, { lbtag: 'duelo.creador' });
    const a = await call(app, 'POST', '/runs', creador, {});
    const code = (await playOut(app, creador, a.json.runId, 0, a.json.view)).view.challenge;
    const j = await call(app, 'POST', '/runs', jugando, { duelo: code });
    const ab = await call(app, 'POST', '/runs', abandona, { duelo: code });
    await call(app, 'POST', '/runs', abandona, {}); // empezar otra partida abandona la del duelo

    // sin haberlo jugado, no se puede espiar
    const no = await call(app, 'GET', '/duelos/' + code, curioso);
    assert.equal(no.status, 403);
    assert.equal(no.json.error.code, 'duelo_no_jugado');

    const d = await call(app, 'GET', '/duelos/' + code, creador);
    assert.deepEqual(d.json.rows.map((r: { status: string; tag: string | null; pos: number | null }) => [r.status, r.tag, r.pos]),
      [['finished', '$duelo.creador', 1], ['active', null, null], ['abandoned', null, null]]);
    // máximo una consulta cada 3 segundos por jugador
    assert.equal((await call(app, 'GET', '/duelos/' + code, creador)).status, 429);

    // quien abandonó vuelve con el link: retoma la misma partida, en el mismo punto
    const back = await call(app, 'POST', '/runs', abandona, { duelo: code });
    assert.equal(back.json.alreadyPlayed, true);
    assert.equal(back.json.runId, ab.json.runId);
    assert.equal(back.json.status, 'active');
    assert.deepEqual(back.json.view, ab.json.view);
    const act = await call(app, 'POST', `/runs/${back.json.runId}/actions`, abandona, { version: back.json.version, action: { type: 'pick', option: 0 } });
    assert.equal(act.status, 200);
    void j;
  });

  test('el código de la partida no sale hasta el final', async () => {
    const t = newUser();
    const c = await call(app, 'POST', '/runs', t, {});
    const act = await call(app, 'POST', `/runs/${c.json.runId}/actions`, t, { version: 0, action: E.validActions(c.json.view)[0] });
    const reload = await call(app, 'GET', '/runs/' + c.json.runId, t);
    const { view } = await playOut(app, t, c.json.runId, act.json.version, act.json.view);
    assert.match(view.challenge, /^MGN-[A-Z0-9]{5}$/);
    assert.ok(!JSON.stringify([c.json, act.json, reload.json]).includes(view.challenge), 'el código salió antes del final');
  });

  test('código de duelo inválido → 400', async () => {
    const t = newUser();
    for (const duelo of ['MGN-123', 'XYZ-ABCDE', "MGN-AAAAA'--", 123]) {
      assert.equal((await call(app, 'POST', '/runs', t, { duelo })).status, 400, String(duelo));
    }
    assert.equal((await call(app, 'GET', '/duelos/nada', t)).status, 400);
  });
});

describe('$LBtag y ranking', () => {
  test('formato, normalización y unicidad', async () => {
    const a = newUser(), b = newUser();
    for (const lbtag of ['ab', 'con espacio', '<script>', 'x'.repeat(21), 42, null]) {
      assert.equal((await call(app, 'PUT', '/me/lbtag', a, { lbtag })).status, 400, String(lbtag));
    }
    const ok = await call(app, 'PUT', '/me/lbtag', a, { lbtag: '  $Tincho.OK ' });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.lbtag, 'tincho.ok');
    assert.equal((await call(app, 'GET', '/me', a)).json.lbtag, 'tincho.ok');
    const taken = await call(app, 'PUT', '/me/lbtag', b, { lbtag: 'TINCHO.OK' });
    assert.equal(taken.status, 409);
    assert.equal(taken.json.error.code, 'lbtag_taken');
  });

  test('solo cuentan partidas terminadas, sin duelo, sin flag y con $LBtag', async () => {
    const con = newUser(), sin = newUser(), duelista = newUser(), rapido = newUser();
    const tag = (u: string, t: string) => call(app, 'PUT', '/me/lbtag', u, { lbtag: t });
    await tag(con, 'rank.con'); await tag(duelista, 'rank.duelo'); await tag(rapido, 'rank.rapido');

    const play = async (a: App, u: string, body: object) => {
      const c = await call(a, 'POST', '/runs', u, body);
      return playOut(a, u, c.json.runId, 0, c.json.view);
    };
    const r1 = await play(app, con, {});
    await play(app, sin, {});
    await play(app, duelista, { duelo: 'MGN-DUELO' });
    // con el mínimo de 40 s del default, una partida de milisegundos queda marcada
    const strict = makeApp({ limits: { actionsPerSecond: 10000 } });
    await play(strict, rapido, {});
    const [f] = await db()`select flagged, flag_reason from game.runs r join game.players p on p.id = r.player_id where p.lbtag = 'rank.rapido'`;
    assert.deepEqual({ ...f }, { flagged: true, flag_reason: 'demasiado_rapida' });
    // una partida sin terminar tampoco
    await call(app, 'POST', '/runs', con, {});

    for (const by of ['rareza', 'plata']) {
      for (const period of ['semana', 'historico']) {
        const r = await call(app, 'GET', `/ranking?by=${by}&period=${period}`, con);
        assert.equal(r.status, 200);
        assertNoLeaks(r.json, 'ranking');
        const tags = r.json.rows.map((x: { lbtag: string }) => x.lbtag);
        assert.ok(tags.includes('rank.con'), by + period);
        for (const no of ['rank.duelo', 'rank.rapido']) assert.ok(!tags.includes(no), no);
        const mine = r.json.rows.find((x: { lbtag: string }) => x.lbtag === 'rank.con');
        assert.equal(mine.mine, true);
        assert.equal(mine.capital, Math.round(r1.view.final!.capital));
      }
    }
    assert.equal((await call(app, 'GET', '/ranking?by=nada', con)).status, 400);
  });

  test('ranking por rareza: mejor partida por jugador, lo más raro primero', async () => {
    const s = db();
    const u1 = newUser(), u2 = newUser();
    await call(app, 'PUT', '/me/lbtag', u1, { lbtag: 'orden.uno' });
    await call(app, 'PUT', '/me/lbtag', u2, { lbtag: 'orden.dos' });
    // partidas terminadas cargadas a mano con finales conocidos
    const ins = async (u: string, key: string, cap: number) => s`
      insert into game.runs (player_id, seed_code, ranked, status, state, config, final_key, final_capital, finished_at)
      values (${u.slice(5)}, 'MGN-AAAAA', true, 'finished', '{}'::jsonb, '{}'::jsonb, ${key}, ${cap}, now())`;
    await ins(u1, 'constructor', 90000000);
    await ins(u1, 'servido', 1000); // la más rara de u1
    await ins(u2, 'imperio', 600000000);
    const r = await call(app, 'GET', '/ranking?by=rareza&period=historico', u1);
    const mine = r.json.rows.filter((x: { lbtag: string }) => x.lbtag.startsWith('orden.'));
    assert.deepEqual(mine.map((x: { lbtag: string; titleKey: string }) => [x.lbtag, x.titleKey]),
      [['orden.uno', 'servido'], ['orden.dos', 'imperio']]);
    const p = await call(app, 'GET', '/ranking?by=plata&period=historico', u1);
    const mp = p.json.rows.filter((x: { lbtag: string }) => x.lbtag.startsWith('orden.'));
    assert.deepEqual(mp.map((x: { lbtag: string; capital: number }) => [x.lbtag, x.capital]),
      [['orden.dos', 600000000], ['orden.uno', 90000000]]);
  });
});

describe('Fase 4: tabla semanal y rareza real', () => {
  test('la tabla semanal arranca el lunes (hora argentina); la histórica no se reinicia', async () => {
    const s = db();
    const u = newUser();
    await call(app, 'PUT', '/me/lbtag', u, { lbtag: 'semana.pasada' });
    // terminada un minuto antes del último lunes 00:00 en Buenos Aires
    await s`
      insert into game.runs (player_id, seed_code, ranked, status, state, config, final_key, final_capital, finished_at)
      values (${u.slice(5)}, 'MGN-BBBBB', true, 'finished', '{}'::jsonb, '{}'::jsonb, 'magnate', 777000000,
        (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires') - interval '1 minute')`;
    const tags = async (period: string) =>
      (await call(app, 'GET', `/ranking?by=plata&period=${period}`, u)).json.rows.map((x: { lbtag: string }) => x.lbtag);
    assert.ok(!(await tags('semana')).includes('semana.pasada'));
    assert.ok((await tags('historico')).includes('semana.pasada'));
  });

  test('GET /rareza: simulada hasta que el job tiene muestra, después la real', async () => {
    const s = db();
    const t = newUser();
    const antes = await call(app, 'GET', '/rareza', t);
    assert.equal(antes.status, 200);
    assert.equal(antes.json.fuente, 'simulacion');
    assert.equal(antes.json.pct.imperio, 0.7);
    assert.equal(Object.keys(antes.json.pct).length, 19);
    const backup = await s`select final_key, pct, sample from game.rareza`;
    try {
      // sin muestra suficiente no toca nada
      const [{ n: sinTocar }] = await s`select game.recompute_rareza(1000000) as n`;
      assert.equal(sinTocar, 0);
      assert.equal((await call(app, 'GET', '/rareza', t)).json.fuente, 'simulacion');
      const [{ n }] = await s`select game.recompute_rareza(1) as n`;
      const [{ total }] = await s`select count(*)::int as total from game.runs where status = 'finished' and not flagged`;
      assert.equal(n, total);
      const r = (await call(app, 'GET', '/rareza', t)).json;
      assert.equal(r.fuente, 'real');
      assert.equal(r.partidas, total);
      const [{ magnate }] = await s`select count(*)::int as magnate from game.runs where status = 'finished' and not flagged and final_key = 'magnate'`;
      assert.equal(r.pct.magnate, Math.max(0.1, Math.round(1000 * magnate / total) / 10));
      for (const v of Object.values(r.pct)) assert.ok((v as number) >= 0.1);
    } finally {
      for (const b of backup) await s`update game.rareza set pct = ${b.pct}, sample = ${b.sample} where final_key = ${b.final_key}`;
    }
  });

  test('anon y authenticated no pueden correr el recálculo', async () => {
    const s = db();
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(s.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`select game.recompute_rareza(1)`;
      }), role);
    }
  });
});

describe('anti-abuso y CORS', () => {
  test('rate limit de acciones y de partidas nuevas → 429', async () => {
    const a = makeApp({ limits: { actionsPerSecond: 2, runsPerHour: 3 } });
    const t = newUser();
    const c = await call(a, 'POST', '/runs', t, {});
    const rs = await Promise.all([0, 1, 2, 3].map(() =>
      call(a, 'POST', `/runs/${c.json.runId}/actions`, t, { version: 0, action: { type: 'pick', option: 0 } })));
    assert.ok(rs.some((r) => r.status === 429), rs.map((r) => r.status).join(','));
    const r2 = await call(a, 'POST', '/runs', t, {});
    const r3 = await call(a, 'POST', '/runs', t, {});
    const r4 = await call(a, 'POST', '/runs', t, {});
    assert.deepEqual([r2.status, r3.status, r4.status], [201, 201, 429]);
    assert.equal(r4.json.error.code, 'rate_limited');
  });

  test('CORS: solo los orígenes permitidos', async () => {
    const ok = await app.request('/api/runs', { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
    const no = await app.request('/api/runs', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
    assert.equal(no.headers.get('access-control-allow-origin'), null);
  });

  test('errores internos no filtran detalles', async () => {
    const broken = makeApp({ store: { ...(await import('../functions/_shared/store.ts')).pgStore(db()), getMe: () => Promise.reject(new Error('password=supersecreto')) } });
    const r = await call(broken, 'GET', '/me', newUser());
    assert.equal(r.status, 500);
    assert.ok(!JSON.stringify(r.json).includes('supersecreto'));
  });
});
