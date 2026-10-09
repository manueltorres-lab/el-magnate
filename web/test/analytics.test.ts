// web/analytics.js: Google Analytics solo con Measurement ID y con consentimiento.
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
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) },
    document: { readyState: 'complete', referrer: 'https://l.instagram.com/', head, body, createElement: el, addEventListener: () => {} },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  if (realConfig) vm.runInContext(CONFIG, ctx);
  vm.runInContext(SRC, ctx);
  const banner = () => body.children.find((c: Json) => c.attrs.role === 'dialog' && !c.removed);
  const scripts = () => head.children.filter((c: Json) => c.tag === 'script');
  const button = (label: string) => banner().children.find((c: Json) => c.textContent === label);
  // dataLayer guarda objetos `arguments`: los pasamos a arrays
  const layer = (): Json[] => JSON.parse(JSON.stringify((ctx.dataLayer as Json[]).map((a) => Array.from(a))));
  return { ctx, storage, banner, scripts, button, layer, track: ctx.MagnateAnalytics.track };
}

test('analytics: sin Measurement ID no carga nada ni muestra el aviso', () => {
  const a = load();
  assert.equal(a.banner(), undefined);
  assert.equal(a.scripts().length, 0);
  a.track('game_start', { es_duelo: false });
  assert.equal(a.layer().length, 0);
});

test('analytics: con ID, antes de elegir solo está el aviso (sin marca); "No, gracias" no carga nada', () => {
  const a = load({ id: 'G-TEST123' });
  const b = a.banner();
  assert.ok(b, 'aparece el aviso');
  const texto = b.children.map((c: Json) => c.textContent).join(' ');
  assert.equal(texto, 'Usamos cookies para saber cuánta gente juega y de dónde llega. ¿Va? No, gracias Dale');
  assert.ok(!/LB|Finanzas/i.test(texto), 'el aviso no menciona la marca');
  assert.ok(/#100a18/.test(b.style.cssText) && /Plus Jakarta Sans/.test(b.style.cssText));
  assert.equal(a.scripts().length, 0, 'nada de Google antes de elegir');
  a.track('game_start', { es_duelo: false });
  assert.equal(a.layer().length, 0);

  a.button('No, gracias').click();
  assert.equal(a.banner(), undefined);
  assert.equal(a.storage.get('elmagnate.cookies'), 'no');
  assert.equal(a.scripts().length, 0, 'rechazado: no se carga gtag.js');
  a.track('game_start', { es_duelo: false });
  assert.equal(a.layer().length, 0);

  // en la próxima visita no vuelve a preguntar ni carga nada
  const again = load({ id: 'G-TEST123', stored: 'no' });
  assert.equal(again.banner(), undefined);
  assert.equal(again.scripts().length, 0);
});

test('analytics: "Dale" carga gtag.js con Consent Mode v2 y los eventos pasan filtrados', () => {
  const a = load({ id: 'G-TEST123', href: 'https://elmagnate.com.ar/?duelo=MGN-ABCDE&utm_source=duelo&utm_medium=share' });
  a.button('Dale').click();
  assert.equal(a.storage.get('elmagnate.cookies'), 'si');
  assert.deepEqual(a.scripts().map((s: Json) => s.src), ['https://www.googletagmanager.com/gtag/js?id=G-TEST123']);
  const l = a.layer();
  // el consentimiento por defecto (denegado) va antes que todo lo demás
  assert.deepEqual(l[0], ['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  assert.deepEqual(l[1], ['consent', 'update', { analytics_storage: 'granted' }]);
  const config = l.find((x) => x[0] === 'config');
  assert.equal(config[1], 'G-TEST123');
  assert.equal(config[2].page_location, 'https://elmagnate.com.ar/?duelo=1&utm_source=duelo&utm_medium=share', 'sin el código de duelo, con utm');
  assert.equal(config[2].page_referrer, 'https://l.instagram.com/');

  a.track('game_finish', { final_key: 'imperio', quiebra: false, es_duelo: true, capital_rango: '>100M',
    capital: 512345678, lbtag: 'yo.mismo', player_id: 'x', runId: 'y', challenge: 'MGN-ABCDE' });
  assert.deepEqual(a.layer().pop(), ['event', 'game_finish', { final_key: 'imperio', quiebra: false, es_duelo: true, capital_rango: '>100M' }]);
  assert.equal(a.ctx.MagnateAnalytics.capitalRango(999999), '<1M');
  assert.equal(a.ctx.MagnateAnalytics.capitalRango(14999999), '1M-15M');
  assert.equal(a.ctx.MagnateAnalytics.capitalRango(15e6), '15M-100M');
  assert.equal(a.ctx.MagnateAnalytics.capitalRango(1e8), '>100M');
});

test('analytics: si ya aceptó antes, carga directo sin volver a preguntar', () => {
  const a = load({ id: 'G-TEST123', stored: 'si' });
  assert.equal(a.banner(), undefined);
  assert.equal(a.scripts().length, 1);
});

test('analytics: con la config real, en localhost no carga nada aunque haya aceptado', () => {
  const a = load({ realConfig: true, stored: 'si', href: 'http://localhost:5173/' });
  assert.equal(a.scripts().length, 0);
});

test('analytics: con la config real, en el dominio del juego carga GA con el ID de producción', () => {
  const a = load({ realConfig: true, stored: 'si' });
  assert.equal(a.scripts().length, 1);
  assert.match(a.scripts()[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-[A-Z0-9]+$/);
});
