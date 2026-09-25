// toView nunca filtra información oculta (§5 del handoff). Recorre todas las fases de muchas
// partidas y busca las claves prohibidas en el JSON que saldría al cliente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../index.ts';
import type { GameView } from '../view.ts';
import { codeFrom, mulberry32, TEST_SECRET } from './helpers.ts';

/** Claves que no pueden aparecer nunca, en ningún nivel. */
const NEVER = [
  'order', 'bigUsed', 'showRound', 'showDone', 'rngState', 'seeds', 'serverSalt', 'miniBag', 'tagCounts',
  'riskCounts', 'finalReels', 'pool', 'min', 'max', 'pending', 'pct', 'fixedAdd', 'cond', 'tag_effect',
  'roundStart', 'lastTag', 'titleKeyPreview',
];

function keysDeep(x: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(x)) x.forEach((v) => keysDeep(v, out));
  else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) { out.add(k); keysDeep(v, out); }
  }
  return out;
}

function checkView(v: GameView, s: E.RunState) {
  const json = JSON.stringify(v);
  const keys = keysDeep(JSON.parse(json));
  for (const k of NEVER) assert.ok(!keys.has(k), `la vista (${v.phase}) incluye "${k}"`);

  // nada de los escenarios futuros: ningún texto de order[round+1..] aparece
  for (const sc of s.order.slice(s.round + 1)) {
    if (sc !== s.current && sc.text !== s.current.text) assert.ok(!json.includes(sc.text), 'filtra un escenario futuro');
  }
  // sobres: los montos solo al abrir
  if (v.mini?.kind === 'sobres' && !v.mini.done) {
    assert.equal(v.mini.outcomes, null);
    for (const o of s.slots!.outcomes ?? []) assert.ok(!json.includes(':' + o + ',') && !json.includes(':' + o + ']'));
  }
  // ruleta: el sector solo después del giro
  if (v.mini?.kind === 'ruleta' && !v.mini.done) assert.equal(v.mini.sector, null);
  // tragamonedas: sin rodillos antes de girar
  if (v.mini?.kind === 'slots' && !v.mini.done) assert.equal(v.mini.reels, null);
  // blackjack: la banca tapada hasta plantarse o pasarse
  if (v.mini?.kind === 'blackjack' && v.mini.phase === 'play' && !v.mini.done) {
    assert.ok(v.mini.dealer.slice(1).every((c) => 'hidden' in c), 'se ve la carta tapada de la banca');
    assert.equal(v.mini.dealer.length, 2);
    assert.equal(v.mini.dealerVal, E.cardVal(s.slots!.dealer[0].r), 'el valor de la banca delata la tapada');
  }
  // El Sillón: la respuesta y el porqué solo después de responder; nunca las preguntas siguientes
  if (v.quiz) {
    if (v.quiz.picked == null) {
      assert.equal(v.quiz.ok, null);
      assert.equal(v.quiz.why, null);
    }
    const q = s.quiz!;
    for (const later of q.pool.slice(q.idx + 1)) assert.ok(!json.includes(later.q), 'filtra una pregunta siguiente');
    if (v.quiz.picked == null) assert.ok(!json.includes(q.pool[q.idx].why), 'filtra el porqué');
  }
  // antes de terminar no hay final
  if (v.screen !== 'result') assert.equal(v.final, null);
}

test('toView no filtra información oculta en ninguna fase', async () => {
  const rand = mulberry32(31337);
  const k = await E.importSecret(TEST_SECRET);
  const phases = new Set<string>();
  const kinds = new Set<string>();
  for (let g = 0; g < 500; g++) {
    const code = codeFrom(rand);
    const cfg = { eventChance: 1 };
    let s = E.createRun({ code, seeds: await E.deriveSeeds(k, code, 12) }, cfg);
    while (true) {
      const v = E.toView(s, cfg);
      phases.add(v.phase);
      if (v.mini) kinds.add(v.mini.kind + ':' + v.mini.phase + ':' + v.mini.done);
      checkView(v, s);
      if (s.screen === 'result') break;
      const acts = E.validActions(v);
      s = E.step(s, acts[Math.floor(rand() * acts.length)], cfg);
    }
  }
  for (const p of ['toast', 'quiz', 'mini', 'eventChoice', 'choose', 'result']) assert.ok(phases.has(p), 'no se cubrió ' + p);
  for (const kind of ['slots', 'doble', 'sobres', 'ruleta', 'blackjack']) {
    for (const st of [':stake:false', ':play:false', ':play:true']) {
      if (kind === 'slots' || kind === 'ruleta') { if (st === ':play:false') { assert.ok(kinds.has(kind + st)); continue; } }
      assert.ok(kinds.has(kind + st), 'no se cubrió ' + kind + st);
    }
  }
});

test('toView: la 4ª opción aparece con la cabeza quemada o clara, sin rangos', async () => {
  let s = E.createRun({ code: 'MGN-AAAAA', seeds: await E.deriveSeeds(TEST_SECRET, 'MGN-AAAAA', 12) });
  s = { ...s, calma: 20 };
  let v = E.toView(s);
  assert.equal(v.current!.options.length, s.current.options.length + 1);
  assert.equal(v.current!.options.at(-1)!.extra, 'ahogado');
  s = { ...s, calma: 80 };
  v = E.toView(s);
  assert.equal(v.current!.options.at(-1)!.extra, 'fina');
  s = { ...s, calma: 50 };
  v = E.toView(s);
  assert.equal(v.current!.options.length, s.current.options.length);
  assert.ok(v.current!.options.every((o) => !('min' in o) && !('max' in o)));
});
