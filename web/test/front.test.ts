// El front (web/app.js) jugando partidas enteras contra el motor, que hace de servidor.
// Verifica que cada botón mande una acción válida, que la pantalla tenga todos los datos que
// pide el template en cada fase, y que los manejos de error (409, red caída) no rompan nada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRun, deriveSeeds, mkCode, step, toView, validActions, type RunState } from '../../engine/index.ts';

const ROOT = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, ROOT), 'utf8');
const HTML = read('index.html');
const TPL = HTML.slice(HTML.indexOf('<x-dc>'), HTML.indexOf('</x-dc>'));

// variables raíz que usa el template (sin las de los sc-for) y rutas a.b sobre ellas
const loopVars = new Set([...TPL.matchAll(/as="([a-z]+)"/g)].map((m) => m[1]));
const exprs = [...new Set([...TPL.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]))]
  .filter((e) => /^[a-zA-Z_][\w.]*$/.test(e) && e !== 'true' && !loopVars.has(e.split('.')[0]));

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Un servidor falso con el motor de verdad, con la misma forma de respuesta que la API. */
function fakeServer() {
  const runs = new Map<string, { state: RunState; version: number }>();
  const unlocked = new Set<string>();
  let n = 0;
  let tag: string | null = null;
  let rareza: Json = { fuente: 'simulacion', partidas: 0, pct: {} };
  let rivales: Json[] = [];
  const calls: { method: string; path: string; body: Json; auth: string }[] = [];
  let failNext: 'network' | 'conflict' | 'unauthorized' | null = null;
  const reply = (status: number, json: unknown) => ({ ok: status < 400, status, json: async () => json });

  async function fetch(url: string, init: { method: string; body?: string; headers: Record<string, string> }) {
    if (failNext === 'network') { failNext = null; throw new TypeError('Failed to fetch'); }
    if (failNext === 'unauthorized') { failNext = null; return reply(401, { error: { code: 'unauthorized', message: 'Se te venció la sesión.' } }); }
    try { return await handle(url, init); }
    catch (e) { return reply(500, { error: { code: 'internal', message: 'servidor falso: ' + (e as Error).message } }); }
  }
  async function handle(url: string, init: { method: string; body?: string; headers: Record<string, string> }) {
    const path = url.replace(/^.*\/functions\/v1\/api/, '');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method: init.method, path, body, auth: init.headers.authorization });
    if (init.method === 'GET' && path === '/me') return reply(200, { playerId: 'p', lbtag: null, unlocked: [...unlocked] });
    if (init.method === 'PUT' && path === '/me/lbtag') { tag = body.lbtag.toLowerCase(); return reply(200, { lbtag: tag }); }
    if (init.method === 'GET' && path === '/rareza') return reply(200, rareza);
    if (init.method === 'GET' && path.startsWith('/ranking')) {
      // 20 jugadores de relleno y, si ya tiene $LBtag y terminó, la partida propia en el puesto 17
      const rows = Array.from({ length: 20 }, (_, i) => ({ pos: i + 1, lbtag: 'otro' + i, titleKey: 'magnate', capital: 9e8 - i * 1e7, rareza: 7.1, mine: false }));
      const fin = [...runs.values()].find((r) => r.state.screen === 'result');
      if (tag && fin) rows.splice(16, 1, { pos: 17, lbtag: tag, titleKey: fin.state.titleKey!, capital: Math.round(fin.state.capital), rareza: 1, mine: true });
      return reply(200, { by: 'plata', period: path.includes('semana') ? 'semana' : 'historico', rows });
    }
    const codeOf = (id: string) => runs.get(id)!.state.challenge;
    const dueloRes = (code: string) => {
      const mios = [...runs.keys()].filter((id) => codeOf(id) === code).slice(0, 1).map((id) => {
        const st = runs.get(id)!.state, fin = st.screen === 'result';
        return { tag: tag ? '$' + tag : null, mine: true, status: fin ? 'finished' : 'active', icon: fin ? '★' : '', title: fin ? st.titleKey : '', amount: fin ? '$' + Math.round(st.capital) : '', cap: fin ? st.capital : -1 };
      });
      const all = [...rivales, ...mios].sort((a, b) => b.cap - a.cap);
      let pos = 0;
      return { code, rows: all.map(({ cap, ...r }) => ({ ...r, pos: r.status === 'finished' ? ++pos : null })) };
    };
    if (init.method === 'GET' && path.startsWith('/duelos/')) {
      const code = path.slice(8);
      if (![...runs.keys()].some((id) => codeOf(id) === code)) return reply(403, { error: { code: 'duelo_no_jugado', message: 'Jugá el duelo primero.' } });
      return reply(200, dueloRes(code));
    }
    if (init.method === 'POST' && path === '/runs') {
      const prev = body.duelo && [...runs.keys()].find((id) => codeOf(id) === body.duelo);
      if (prev) {
        const r = runs.get(prev)!;
        return reply(200, { alreadyPlayed: true, runId: prev, version: r.version, status: r.state.screen === 'result' ? 'finished' : 'active', view: toView(r.state), duelo: dueloRes(body.duelo) });
      }
      const code = body.duelo || mkCode();
      const seeds = await deriveSeeds('secreto-de-test-con-mas-de-32-caracteres', code, 12);
      const id = 'run-' + ++n;
      runs.set(id, { state: createRun({ code, seeds, duelo: !!body.duelo }), version: 0 });
      return reply(201, { runId: id, version: 0, status: 'active', view: toView(runs.get(id)!.state) });
    }
    const m = /^\/runs\/([\w-]+)(\/actions)?$/.exec(path);
    const run = m && runs.get(m[1]);
    if (!run) return reply(404, { error: { code: 'not_found', message: 'No encontramos esa partida.' } });
    const status = () => (run.state.screen === 'result' ? 'finished' : 'active');
    if (init.method === 'GET') return reply(200, { runId: m![1], version: run.version, status: status(), view: toView(run.state) });
    if (failNext === 'conflict') { failNext = null; run.version++; }
    if (body.version !== run.version) return reply(409, { error: { code: 'version_conflict', message: 'La partida avanzó.' } });
    run.state = step(run.state, body.action); // tira si la acción no corresponde: el test falla
    run.version++;
    if (run.state.screen === 'result') unlocked.add(run.state.titleKey!);
    return reply(200, { version: run.version, status: status(), view: toView(run.state) });
  }
  return { fetch, calls, fail: (k: typeof failNext) => { failNext = k; }, setRareza: (r: Json) => { rareza = r; }, setRivales: (r: Json[]) => { rivales = r; } };
}

/** Carga config.js, data.js y app.js en un contexto aislado, con un setState sincrónico. */
const mem = (): Json => { const m = new Map(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), removeItem: (k: string) => m.delete(k) }; };

function loadFront(server: ReturnType<typeof fakeServer>, storage = { local: mem(), session: mem() }, search = '') {
  const timers: { fn: () => void; ms: number }[] = [];
  const events: [string, Json][] = [];
  const ctx: Json = {
    console, JSON, Math, Object, Array, String, Number, Set, Map, Promise, Error, TypeError, URL, URLSearchParams, Date,
    location: { hostname: 'localhost', href: 'http://localhost:5173/' + search, search, pathname: '/' },
    history: { replaceState: () => { ctx.location.search = ''; } },
    localStorage: storage.local, sessionStorage: storage.session, navigator: {},
    fetch: server.fetch,
    setTimeout: (fn: () => void, ms: number) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    document: {},
    // Analytics de mentira: registra los eventos (el módulo real tiene sus propios tests)
    MagnateAnalytics: {
      track: (e: string, p?: Json) => { events.push([e, JSON.parse(JSON.stringify(p ?? {}))]); },
      capitalRango: (n: number) => (n < 1e6 ? '<1M' : n < 15e6 ? '1M-15M' : n < 100e6 ? '15M-100M' : '>100M'),
    },
  };
  ctx.window = ctx;
  // la sesión anónima, como la maneja supabase-js: tras un error de red sigue guardada
  const auth = {
    session: { access_token: 'tok' } as Json,
    /** el próximo getSession falla por red al querer renovarla */
    loadFailsOnce: false,
    refresh: 'ok' as 'ok' | 'network' | 'dead',
  };
  const networkError = () => Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 });
  ctx.supabase = {
    isAuthRetryableFetchError: (e: Json) => e?.name === 'AuthRetryableFetchError',
    createClient: () => ({ auth: {
      getSession: async () => {
        if (auth.loadFailsOnce) { auth.loadFailsOnce = false; return { data: { session: null }, error: networkError() }; }
        return { data: { session: auth.session }, error: null };
      },
      refreshSession: async () => {
        if (auth.refresh === 'network') return { data: { session: null }, error: networkError() };
        if (auth.refresh === 'dead' || !auth.session) return { data: { session: null }, error: Object.assign(new Error('Invalid Refresh Token'), { status: 400 }) };
        return { data: { session: auth.session }, error: null };
      },
      signInAnonymously: async () => { auth.session = { access_token: 'tok-jugador-nuevo' }; return { data: { session: auth.session }, error: null }; },
      signOut: async () => { auth.session = null; return { error: null }; },
    } }),
  };
  vm.createContext(ctx);
  for (const f of ['config.js', 'data.js', 'app.js']) vm.runInContext(read(f), ctx, { filename: f });
  const Base = vm.runInContext(`(class { constructor(p){ this.props = p || {}; }
    setState(patch, cb){ const p = typeof patch === 'function' ? patch(this.state, this.props) : patch;
      this.state = Object.assign({}, this.state, p); if (cb) cb(); } })`, ctx);
  const C = ctx.MagnateLogic(Base);
  const comp = new C({});
  /** deja correr las promesas pendientes y los timers (animaciones), en orden */
  const settle = async () => {
    await comp.booted;
    for (let i = 0; i < 20 || comp.busy; i++) {
      assert.ok(i < 100000, 'el front quedó trabado');
      await new Promise((r) => setImmediate(r));
      if (timers.length) { timers.sort((a, b) => a.ms - b.ms); timers.shift()!.fn(); i = 0; }
    }
  };
  return { comp, settle, storage, auth, events };
}

function checkBindings(vals: Json, where: string) {
  for (const e of exprs) {
    const parts = e.split('.');
    let cur = vals;
    for (const p of parts) {
      assert.ok(cur != null && p in cur, `${where}: falta {{ ${e} }}`);
      cur = cur[p];
    }
  }
}

/** Toca un botón al azar entre los que muestra la pantalla actual. */
function buttons(vals: Json): (() => unknown)[] {
  if (vals.isStart) return [vals.onStart];
  if (vals.isResult) return [];
  const v = vals.view;
  if (v.isToast) return [vals.onContinue];
  if (v.isScenario) return vals.options.map((o: Json) => o.pick);
  if (v.isChoice) return vals.evOptions.map((o: Json) => o.pick);
  if (v.isQuiz) return vals.quiz.answered ? [vals.quiz.onNext] : vals.quiz.opts.map((o: Json) => o.pick);
  if (v.isMini) {
    if (vals.mini.done) return [vals.onFinishMini];
    if (vals.mini.isSobres) return vals.mini.sobres.map((s: Json) => s.pick);
    return vals.mini.actions.map((a: Json) => a.run);
  }
  return [];
}

test('front: partidas completas con clics al azar, con todos los datos del template en cada pantalla', async () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const seen = new Set<string>();
  for (let g = 0; g < 60; g++) {
    const server = fakeServer();
    const { comp, settle } = loadFront(server);
    comp.componentDidMount();
    await settle();
    let clicks = 0;
    for (;;) {
      const vals = comp.renderVals();
      const screen = vals.isStart ? 'start' : vals.isResult ? 'result' : Object.keys(vals.view).find((k) => vals.view[k]);
      seen.add(screen + (vals.view.isMini ? ':' + (comp.state.view.mini.kind) : ''));
      checkBindings(vals, `partida ${g}, ${screen}`);
      assert.ok(!vals.net.show, `partida ${g}: apareció un error: ${vals.net.msg}`);
      if (vals.isResult) {
        assert.ok(vals.title.title && vals.title.icon, 'el resultado tiene título');
        assert.ok(comp.state.unlocked.includes(comp.state.view.final.titleKey), 'el final entra a la colección');
        assert.ok(vals.shareCopy.includes(vals.title.title));
        break;
      }
      const b = buttons(vals);
      assert.ok(b.length, `partida ${g}: pantalla ${screen} sin botones`);
      // la pantalla ofrece exactamente lo que el motor acepta
      if (!vals.isStart && !(vals.view.isMini && comp.state.view.mini.kind === 'sobres' && !vals.mini.done)) {
        assert.equal(b.length, validActions(comp.state.view).length, `partida ${g}: botones en ${screen}`);
      }
      b[Math.floor(rnd() * b.length)]();
      await settle();
      assert.ok(++clicks < 300, 'la partida no termina');
    }
  }
  for (const k of ['start', 'isScenario', 'isToast', 'isQuiz', 'isChoice', 'isMini:slots', 'isMini:ruleta', 'isMini:doble', 'isMini:sobres', 'isMini:blackjack', 'result']) {
    assert.ok(seen.has(k), 'no se llegó a ' + k + ' (visto: ' + [...seen].join(', ') + ')');
  }
});

test('front: doble clic manda una sola acción', async () => {
  const server = fakeServer();
  const { comp, settle } = loadFront(server);
  comp.componentDidMount();
  await settle();
  comp.renderVals().onStart();
  await settle();
  const pick = comp.renderVals().options[0].pick;
  pick(); pick();
  await settle();
  assert.equal(server.calls.filter((c) => c.path.endsWith('/actions')).length, 1);
});

test('front: sin red muestra "Reintentar" y reintentando sigue la misma partida', async () => {
  const server = fakeServer();
  const { comp, settle } = loadFront(server);
  comp.componentDidMount();
  await settle();
  comp.renderVals().onStart();
  await settle();
  const runId = comp.state.runId;
  server.fail('network');
  comp.renderVals().options[0].pick();
  await settle();
  let vals = comp.renderVals();
  assert.ok(vals.net.show && vals.net.hasRetry, 'aparece el aviso con Reintentar');
  assert.ok(vals.view.isScenario, 'la partida sigue en la misma pantalla');
  vals.net.retry();
  await settle();
  vals = comp.renderVals();
  assert.ok(!vals.net.show);
  assert.ok(vals.view.isToast, 'la jugada se aplicó');
  assert.equal(comp.state.runId, runId);
});

test('front: si la API rechaza el token (401), renueva la sesión y sigue siendo el mismo jugador', async () => {
  const server = fakeServer();
  const { comp, settle } = loadFront(server);
  comp.componentDidMount();
  await settle();
  comp.renderVals().onStart();
  await settle();
  server.fail('unauthorized');
  comp.renderVals().options[0].pick();
  await settle();
  assert.ok(comp.renderVals().view.isToast, 'la jugada se aplicó en el reintento');
  assert.equal(server.calls.at(-1)!.auth, 'Bearer tok');
});

test('front: si la sesión ya no se puede renovar, sigue como jugador nuevo', async () => {
  const server = fakeServer();
  const { comp, settle, auth } = loadFront(server);
  comp.componentDidMount();
  await settle();
  comp.renderVals().onStart();
  await settle();
  auth.refresh = 'dead';
  server.fail('unauthorized');
  comp.renderVals().options[0].pick();
  await settle();
  assert.equal(server.calls.at(-1)!.auth, 'Bearer tok-jugador-nuevo');
});

test('front: si se corta la red al renovar la sesión, avisa y no crea otro jugador', async () => {
  const server = fakeServer();
  const { comp, settle, auth } = loadFront(server);
  comp.componentDidMount();
  await settle();
  comp.renderVals().onStart();
  await settle();
  auth.refresh = 'network';
  server.fail('unauthorized');
  comp.renderVals().options[0].pick();
  await settle();
  const vals = comp.renderVals();
  assert.ok(vals.net.show && vals.net.hasRetry, 'aparece el aviso con Reintentar');
  auth.refresh = 'ok';
  vals.net.retry();
  await settle();
  assert.equal(server.calls.at(-1)!.auth, 'Bearer tok');
});

test('front: si se corta la red al cargar la página, no crea otro jugador', async () => {
  const server = fakeServer();
  const { comp, settle, auth } = loadFront(server);
  auth.loadFailsOnce = true;
  comp.componentDidMount();
  await settle();
  comp.renderVals().onStart();
  await settle();
  assert.equal(server.calls.at(-1)!.auth, 'Bearer tok');
});

test('front: si la partida avanzó en otra pestaña (409), se pone al día sin error', async () => {
  const server = fakeServer();
  const { comp, settle } = loadFront(server);
  comp.componentDidMount();
  await settle();
  comp.renderVals().onStart();
  await settle();
  server.fail('conflict');
  comp.renderVals().options[0].pick();
  await settle();
  const vals = comp.renderVals();
  assert.ok(!vals.net.show);
  assert.equal(comp.state.version, 1, 'tomó la versión del server');
});

test('front: al recargar retoma la partida guardada', async () => {
  const server = fakeServer();
  const a = loadFront(server);
  a.comp.componentDidMount();
  await a.settle();
  a.comp.renderVals().onStart();
  await a.settle();
  a.comp.renderVals().options[1].pick();
  await a.settle();
  // recargar la página: otra instancia con el mismo storage
  const b = loadFront(server, a.storage);
  b.comp.componentDidMount();
  await b.settle();
  const vals = b.comp.renderVals();
  assert.ok(vals.isGame && vals.view.isToast, 'vuelve a la misma pantalla');
  assert.equal(b.comp.state.runId, a.comp.state.runId);
  assert.equal(b.comp.state.version, a.comp.state.version);
});

test('front: en otra pestaña del mismo navegador recuerda el nombre', async () => {
  const server = fakeServer();
  const a = loadFront(server);
  a.comp.componentDidMount();
  await a.settle();
  a.comp.renderVals().onName({ target: { value: 'Maxi' } });
  // pestaña nueva: comparte localStorage, sessionStorage arranca vacío
  const b = loadFront(server, { local: a.storage.local, session: mem() });
  b.comp.componentDidMount();
  await b.settle();
  assert.equal(b.comp.renderVals().playerName, 'Maxi');
});

test('front: en otra pestaña vuelve al resultado de la última partida', async () => {
  const server = fakeServer();
  const a = loadFront(server);
  a.comp.componentDidMount();
  await a.settle();
  a.comp.renderVals().onStart();
  await a.settle();
  await playToEnd(a.comp, a.settle);
  const b = loadFront(server, { local: a.storage.local, session: mem() });
  b.comp.componentDidMount();
  await b.settle();
  assert.ok(b.comp.renderVals().isResult, 'muestra el resultado');
  assert.equal(b.comp.state.runId, a.comp.state.runId);
});

test('front: con un link de duelo muestra la invitación, no la partida anterior', async () => {
  const server = fakeServer();
  const a = loadFront(server);
  a.comp.componentDidMount();
  await a.settle();
  a.comp.renderVals().onStart();
  await a.settle();
  const b = loadFront(server, { local: a.storage.local, session: mem() }, '?duelo=MGN-AAAAA');
  b.comp.componentDidMount();
  await b.settle();
  const vals = b.comp.renderVals();
  assert.ok(vals.esDuelo && !vals.isGame && !vals.isResult, 'queda en la invitación al duelo');
});

test('front: ranking real con tu fila resaltada, y rareza real en la colección y la carta', async () => {
  const server = fakeServer();
  server.setRareza({ fuente: 'real', partidas: 12345, pct: { imperio: 0.4, magnate: 6.5, constructor: 9.9 } });
  const { comp, settle } = loadFront(server);
  comp.componentDidMount();
  await settle();
  let vals = comp.renderVals();
  assert.equal(vals.colNote, 'Los porcentajes salen de 12.345 partidas reales.');
  // la colección sigue el orden de ORDEN_COL: servido, insomne, imperio…
  assert.equal(vals.coleccion[2].pct, '0,4%');
  // jugar hasta el final con la primera opción siempre
  vals.onStart(); await settle();
  for (let i = 0; i < 300 && !comp.renderVals().isResult; i++) { buttons(comp.renderVals())[0](); await settle(); }
  vals = comp.renderVals();
  assert.ok(vals.isResult);
  const key = comp.state.view.final.titleKey;
  if (key === 'magnate') assert.equal(vals.rarezaPct, '6,5');
  assert.ok(vals.shareCopy.includes(String(comp.rarezaOf(key)).replace('.', ',') + '%'));
  // sin $LBtag: 13 filas de otros
  assert.equal(vals.rankingPlata.length, 13);
  assert.equal(vals.rankNote, 'Cuenta la mejor partida de cada $LBtag. Las partidas de duelo no suman.');
  // con $LBtag: la propia aparece al final, con su puesto real y resaltada
  comp.setState({ lbtag: 'Yo.Mismo' });
  comp.renderVals().onSaveTag(); await settle();
  vals = comp.renderVals();
  const last = vals.rankingPlata[vals.rankingPlata.length - 1];
  assert.equal(vals.rankingPlata.length, 14);
  assert.deepEqual([last.pos, last.tag, last.tagColor], ['17', '$yo.mismo', '#73ffa1']);
  assert.equal(vals.rankingHist.length, 14);
});

async function playToEnd(comp: Json, settle: () => Promise<void>) {
  for (let i = 0; i < 300 && !comp.renderVals().isResult; i++) { buttons(comp.renderVals())[0](); await settle(); }
  assert.ok(comp.renderVals().isResult, 'la partida terminó');
}

test('front: duelo — el creador ve quién jugó su partida; el retado ve su puesto; volver al link muestra los resultados', async () => {
  const server = fakeServer();
  // el creador: partida normal, al final "Quién jugó tu partida" vacío
  const a = loadFront(server);
  a.comp.componentDidMount(); await a.settle();
  a.comp.renderVals().onStart(); await a.settle();
  await playToEnd(a.comp, a.settle);
  let d = a.comp.renderVals().duelo;
  assert.equal(a.comp.renderVals().esDuelo, false);
  assert.deepEqual([d.creador, d.empty, d.ready], [true, true, false]);
  assert.equal(d.emptyTitle, 'Todavía nadie jugó tu partida.');
  const code = a.comp.state.view.challenge;
  assert.equal(d.code, code);

  // el retado entra con ?duelo=: aviso en el inicio, juega y ve la tabla con su puesto
  const server2 = fakeServer();
  server2.setRivales([
    { tag: '$sofi', mine: false, status: 'finished', icon: '👑', title: 'El Imperio', amount: '$999.999.999', cap: 1e12 },
    { tag: null, mine: false, status: 'active', icon: '', title: '', amount: '', cap: -2 },
  ]);
  const b = loadFront(server2, undefined, '?duelo=' + code);
  b.comp.componentDidMount(); await b.settle();
  let vals = b.comp.renderVals();
  assert.equal(vals.esDuelo, true);
  assert.equal(vals.dueloCode, code);
  vals.onStart(); await b.settle();
  assert.equal(server2.calls.find((c) => c.path === '/runs')!.body.duelo, code);
  await playToEnd(b.comp, b.settle);
  vals = b.comp.renderVals();
  d = vals.duelo;
  assert.equal(vals.esDuelo, true);
  assert.deepEqual([d.creador, d.ready, d.empty], [false, true, false]);
  assert.deepEqual(d.rows.map((r: Json) => [r.posText, r.tagText, r.isActive]), [['01', '$sofi', false], ['02', 'Anónimo', false], ['—', 'Anónimo', true]]);
  assert.equal(d.summary, 'Quedaste 2° de 2. Arriba de todo: $sofi con 👑 El Imperio.');
  assert.ok(d.hasActive && d.hasAnon);
  assert.equal(d.rows[1].tagColor, '#73ffa1');

  // recarga con el mismo link: no arranca otra partida, muestra el resultado y la tabla
  const c = loadFront(server2, undefined, '?duelo=' + code);
  c.comp.componentDidMount(); await c.settle();
  c.comp.renderVals().onStart(); await c.settle();
  vals = c.comp.renderVals();
  assert.ok(vals.isResult, 'va directo a los resultados');
  assert.equal(vals.duelo.rows.length, 3);
  assert.equal(server2.calls.filter((x) => x.path === '/runs').length, 2);

  // "Jugar otra partida" después del duelo arranca una partida normal
  vals.onRestart(); await c.settle();
  vals = c.comp.renderVals();
  assert.ok(vals.isStart && !vals.esDuelo);
  vals.onStart(); await c.settle();
  assert.equal(server2.calls.filter((x) => x.path === '/runs').pop()!.body.duelo, undefined);
});

test('front: eventos de Analytics en una partida, sin datos personales', async () => {
  const server = fakeServer();
  const { comp, settle, events, storage } = loadFront(server);
  comp.componentDidMount(); await settle();
  comp.renderVals().onStart(); await settle();
  assert.deepEqual(events[0], ['game_start', { es_duelo: false }]);
  // jugar hasta el final, pasando por El Sillón (siempre aparece una vez por partida)
  await playToEnd(comp, settle);
  const names = events.map(([e]) => e);
  assert.equal(names.filter((e) => e === 'sillon_play').length, 1, 'El Sillón una vez');
  const fin = events.find(([e]) => e === 'game_finish')![1];
  const v = comp.state.view;
  assert.deepEqual(Object.keys(fin).sort(), ['capital_rango', 'es_duelo', 'final_key', 'quiebra']);
  assert.equal(fin.final_key, v.final.titleKey);
  assert.equal(fin.es_duelo, false);
  assert.ok(['<1M', '1M-15M', '15M-100M', '>100M'].includes(fin.capital_rango));

  // compartir el duelo: evento y link con utm
  const vals = comp.renderVals();
  vals.onCopyDuelo();
  assert.deepEqual(events.at(-1), ['duelo_share', {}]);
  assert.match(vals.challengeLink, /\?duelo=MGN-[A-Z0-9]{5}&utm_source=duelo&utm_medium=share$/);
  vals.onStoryDownload();
  assert.deepEqual(events.at(-1), ['story_download', { final_key: v.final.titleKey }]);
  comp.setState({ lbtag: 'yo.mismo' });
  comp.renderVals().onSaveTag(); await settle();
  assert.deepEqual(events.at(-1), ['lbtag_saved', {}]);

  // ningún evento lleva el $LBtag, ids, el código de duelo ni el capital exacto
  const all = JSON.stringify(events);
  for (const no of ['yo.mismo', comp.state.runId, v.challenge, String(Math.round(v.final.capital))]) {
    assert.ok(!all.includes(no), 'se filtró ' + no);
  }

  // al recargar en la pantalla final se retoma el resultado, sin volver a mandar game_finish
  const b = loadFront(server, storage);
  b.comp.componentDidMount(); await b.settle();
  assert.ok(b.comp.renderVals().isResult);
  assert.deepEqual(b.events, []);
});
