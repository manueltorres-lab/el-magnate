// web/analytics.js: Google Analytics mide siempre que haya Measurement ID, sin aviso de cookies.
// Con un DOM mínimo falso: se verifica qué se agrega a la página y qué llega a dataLayer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../analytics.js', import.meta.url), 'utf8');
const CONFIG = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function el(tag: string): Json {
  const listeners: Record<string, () => void> = {};
  const e: Json = {
    tag, style: {}, attrs: {}, children: [] as Json[], textContent: '', offsetHeight: 60, removed: false,
    setAttribute: (k: string, v: string) => { e.attrs[k] = v; },
    append: (...c: Json[]) => { e.children.push(...c); },
    appendChild: (c: Json) => { e.children.push(c); },
    addEventListener: (ev: string, fn: () => void) => { listeners[ev] = fn; },
    click: () => listeners.click?.(),
    remove: () => { e.removed = true; },
  };
  return e;
}

function load({ id = '', stored = null as string | null, href = 'https://elmagnate.com.ar/', realConfig = false } = {}) {
  const storage = new Map<string, string>();
  if (stored) storage.set('elmagnate.cookies', stored);
  const head = el('head'), body = el('body');
  const ctx: Json = {
    URL, Object, Set, Date, encodeURIComponent,
    MAGNATE_CONFIG: { gaMeasurementId: id },
    location: new URL(href),
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) },
    document: { readyState: 'complete', referrer: 'https://l.instagram.com/', head, body, createElement: el, addEventListener: () => {} },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  if (realConfig) vm.runInContext(CONFIG, ctx);
  vm.runInContext(SRC, ctx);
  const scripts = () => head.children.filter((c: Json) => c.tag === 'script');
  // dataLayer guarda objetos `arguments`: los pasamos a arrays
  const layer = (): Json[] => JSON.parse(JSON.stringify((ctx.dataLayer as Json[]).map((a) => Array.from(a))));
  return { ctx, storage, body, scripts, layer, track: ctx.MagnateAnalytics.track };
}

test('analytics: sin Measurement ID no carga nada', () => {
  const a = load();
  assert.equal(a.scripts().length, 0);
  a.track('game_start', { es_duelo: false });
  assert.equal(a.layer().length, 0);
});

test('analytics: con ID mide desde que abre la página, sin aviso ni espacio reservado abajo', () => {
  for (const href of ['https://elmagnate.com.ar/', 'https://www.elmagnate.com.ar/?duelo=MGN-ABCDE']) {
    const a = load({ id: 'G-TEST123', href });
    assert.equal(a.body.children.length, 0, 'no se agrega nada a la página: ' + href);
    assert.equal(a.body.style.paddingBottom, undefined);
    assert.deepEqual(a.scripts().map((s: Json) => s.src), ['https://www.googletagmanager.com/gtag/js?id=G-TEST123']);
    a.track('game_start', { es_duelo: false });
    assert.deepEqual(a.layer().pop(), ['event', 'game_start', { es_duelo: false }]);
  }
});

test('analytics: la publicidad queda denegada; analytics_storage no se toca', () => {
  const l = load({ id: 'G-TEST123' }).layer();
  assert.deepEqual(l[0], ['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  assert.equal(l.filter((x) => x[0] === 'consent').length, 1, 'sin consent update');
  assert.ok(!JSON.stringify(l).includes('analytics_storage'));
});

test('analytics: si alguien había rechazado en el aviso viejo, mide igual y se borra la elección', () => {
  for (const stored of ['no', 'si']) {
    const a = load({ id: 'G-TEST123', stored });
    assert.equal(a.storage.has('elmagnate.cookies'), false);
    assert.equal(a.scripts().length, 1);
  }
});

test('analytics: la URL que llega a GA no lleva el código de duelo y los eventos pasan filtrados', () => {
  const a = load({ id: 'G-TEST123', href: 'https://elmagnate.com.ar/?duelo=MGN-ABCDE&utm_source=duelo&utm_medium=share' });
  const config = a.layer().find((x) => x[0] === 'config');
  assert.equal(config[1], 'G-TEST123');
  assert.equal(config[2].page_location, 'https://elmagnate.com.ar/?duelo=1&utm_source=duelo&utm_medium=share', 'sin el código de duelo, con utm');
  assert.equal(config[2].page_referrer, 'https://l.instagram.com/');

  a.track('game_finish', { final_key: 'imperio', quiebra: false, es_duelo: true, capital_rango: '>100M',
    capital: 512345678, lbtag: 'yo.mismo', player_id: 'x', runId: 'y', challenge: 'MGN-ABCDE' });
  assert.deepEqual(a.layer().pop(), ['event', 'game_finish', { final_key: 'imperio', quiebra: false, es_duelo: true, capital_rango: '>100M' }]);
  assert.ok(!JSON.stringify(a.layer()).includes('MGN-ABCDE'));
  assert.equal(a.ctx.MagnateAnalytics.capitalRango(999999), '<1M');
  assert.equal(a.ctx.MagnateAnalytics.capitalRango(14999999), '1M-15M');
  assert.equal(a.ctx.MagnateAnalytics.capitalRango(15e6), '15M-100M');
  assert.equal(a.ctx.MagnateAnalytics.capitalRango(1e8), '>100M');
});

test('analytics: con la config real, en localhost no carga nada', () => {
  const a = load({ realConfig: true, href: 'http://localhost:5173/' });
  assert.equal(a.scripts().length, 0);
});

test('analytics: con la config real, en el dominio del juego carga GA con el ID de producción', () => {
  const a = load({ realConfig: true });
  assert.equal(a.scripts().length, 1);
  assert.match(a.scripts()[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-[A-Z0-9]+$/);
});
