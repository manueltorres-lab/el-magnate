// Invariantes en cada paso y control de fase: sin NaN, capital ≥ 0, rep/cabeza en 0–100,
// toda partida termina, ninguna acción válida tira error, y toda acción fuera de fase se
// rechaza sin tocar el estado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../index.ts';
import type { Action, RunState } from '../types.ts';
import { codeFrom, mulberry32, TEST_SECRET } from './helpers.ts';

/** Todas las acciones posibles, válidas o no, con payloads buenos y malos. */
const ALL_ACTIONS: Action[] = [
  ...[0, 1, 2, 3, 4, -1].map((option) => ({ type: 'pick', option }) as Action),
  { type: 'continue' },
  ...[0, 1, 2].map((option) => ({ type: 'eventPick', option }) as Action),
  ...[0, 1, 2, 3].map((option) => ({ type: 'quizAnswer', option }) as Action),
  { type: 'quizNext' }, { type: 'quizClose' },
  ...[0.05, 0.12, 0.25, 0.5, 1, 10].map((frac) => ({ type: 'miniStake', frac }) as Action),
  { type: 'miniSkip' }, { type: 'slotsSpin' }, { type: 'ruletaSpin' },
  { type: 'dobleDouble' }, { type: 'dobleCashout' },
  ...[0, 1, 2, 3].map((index) => ({ type: 'sobreOpen', index }) as Action),
  { type: 'bjHit' }, { type: 'bjStand' }, { type: 'miniFinish' },
];

function checkNumbers(x: unknown, path: string) {
  if (typeof x === 'number') assert.ok(Number.isFinite(x), `${path} = ${x}`);
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) checkNumbers(v, path + '.' + k);
}

function checkState(s: RunState) {
  checkNumbers(s, 'state');
  assert.ok(s.capital >= 0, 'capital negativo');
  for (const k of ['rep', 'calma'] as const) {
    assert.ok(Number.isInteger(s[k]) && s[k] >= 0 && s[k] <= 100, `${k} = ${s[k]}`);
  }
  assert.ok(s.round >= 0 && s.round < 20);
  if (s.screen === 'result') assert.ok(s.titleKey, 'final sin título');
}

const key = (a: Action) => JSON.stringify(a);

test('invariantes y control de fase en 150 partidas al azar', async () => {
  const rand = mulberry32(4242);
  const k = await E.importSecret(TEST_SECRET);
  for (let g = 0; g < 150; g++) {
    const cfg = g % 4 === 0 ? { eventChance: 1 } : {};
    const code = codeFrom(rand);
    let s = E.createRun({ code, seeds: await E.deriveSeeds(k, code, 12) }, cfg);
    checkState(s);
    let n = 0;
    while (s.screen !== 'result') {
      const valid = E.validActions(E.toView(s, cfg));
      const validKeys = new Set(valid.map(key));
      const before = JSON.stringify(s);
      for (const a of ALL_ACTIONS) {
        if (validKeys.has(key(a))) continue;
        assert.throws(() => E.step(s, a, cfg), E.EngineError, `${E.phaseOf(s)} aceptó ${key(a)}`);
      }
      assert.equal(JSON.stringify(s), before, 'una acción rechazada modificó el estado');
      const a = valid[Math.floor(rand() * valid.length)];
      const next = E.step(s, a, cfg);
      assert.equal(JSON.stringify(s), before, 'step mutó el estado de entrada');
      s = next;
      checkState(s);
      assert.ok(++n < 300, 'la partida no termina');
    }
    // terminada: nada más es válido
    for (const a of ALL_ACTIONS) assert.throws(() => E.step(s, a, cfg), E.EngineError);
  }
});

test('acciones malformadas se rechazan', async () => {
  const s = E.createRun({ code: 'MGN-AAAAA', seeds: await E.deriveSeeds(TEST_SECRET, 'MGN-AAAAA', 12) });
  const bad: unknown[] = [
    null, 'pick', {}, { type: 'nada' }, { type: 'pick' }, { type: 'pick', option: '1' },
    { type: 'pick', option: 1.5 }, { type: 'pick', option: NaN }, { type: 'pick', option: 99 },
    { type: 'constructor' }, { type: '__proto__' },
  ];
  for (const a of bad) assert.throws(() => E.step(s, a as Action), E.EngineError, JSON.stringify(a));
});

test('duelo: mismo código, mismas decisiones → mismos 12 escenarios y mismo resultado', async () => {
  const code = 'MGN-DUELO';
  const seeds = await E.deriveSeeds(TEST_SECRET, code, 12);
  const run = () => {
    let s = E.createRun({ code, seeds, duelo: true });
    const seen: string[] = [];
    while (s.screen !== 'result') {
      const v = E.toView(s);
      if (v.phase === 'choose') seen.push(v.current!.text);
      s = E.step(s, E.validActions(v)[0]);
    }
    return { seen, capital: s.capital, titleKey: s.titleKey, order: s.order.map((o) => o.text) };
  };
  const a = run(), b = run();
  assert.deepEqual(a, b);
  assert.equal(a.order.length, 12);
});

test('config: rounds se acota a 6–20 como en el original', () => {
  assert.equal(E.resolveConfig({ rounds: 2 }).rounds, 6);
  assert.equal(E.resolveConfig({ rounds: 99 }).rounds, 20);
  assert.equal(E.resolveConfig({}).rounds, 12);
  assert.equal(E.resolveConfig({}).startingCapital, 500000);
});
