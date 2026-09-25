// Golden: con SERVER_SECRET fijo y una secuencia de acciones fija, el estado final es siempre
// el mismo. Si cambia a propósito, regenerar con UPDATE_GOLDEN=1 npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as E from '../index.ts';
import type { Action, RunState } from '../types.ts';
import { mulberry32, TEST_SECRET } from './helpers.ts';

const SNAP = new URL('./golden.snap.json', import.meta.url);
const CODES = ['MGN-GOLD1', 'MGN-GOLD2', 'MGN-ZZZZZ', 'MGN-A2B3C'];

async function play(code: string): Promise<{ state: RunState; actions: Action[] }> {
  const seeds = await E.deriveSeeds(TEST_SECRET, code, 12);
  let s = E.createRun({ code, seeds });
  const rand = mulberry32(E.hashStr(code));
  const actions: Action[] = [];
  while (s.screen !== 'result') {
    const acts = E.validActions(E.toView(s));
    const a = acts[Math.floor(rand() * acts.length)];
    actions.push(a);
    s = E.step(s, a);
  }
  return { state: s, actions };
}

const digest = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

test('golden: semillas HMAC y estado final estables', async () => {
  const snap: Record<string, unknown> = {};
  for (const code of CODES) {
    const { state, actions } = await play(code);
    // se repite: misma entrada, misma salida
    const again = await play(code);
    assert.equal(digest(again.state), digest(state));
    snap[code] = {
      seeds: state.seeds,
      actions: actions.length,
      titleKey: state.titleKey,
      capital: state.capital,
      stateSha256: digest(state),
    };
  }
  if (process.env.UPDATE_GOLDEN || !existsSync(SNAP)) {
    writeFileSync(SNAP, JSON.stringify(snap, null, 2) + '\n');
    if (!process.env.UPDATE_GOLDEN) assert.fail('snapshot creado; volvé a correr los tests');
    return;
  }
  assert.deepEqual(snap, JSON.parse(readFileSync(SNAP, 'utf8')));
});

test('HMAC: la semilla depende del secreto y no coincide con la vieja', async () => {
  const a = await E.deriveSeeds(TEST_SECRET, 'MGN-GOLD1', 12);
  const b = await E.deriveSeeds(TEST_SECRET + 'x', 'MGN-GOLD1', 12);
  assert.equal(a.length, 13);
  assert.notDeepEqual(a, b);
  assert.notDeepEqual(a, E.legacySeeds('MGN-GOLD1', 12));
  assert.ok(a.every((x) => Number.isInteger(x) && x > 0 && x <= 0xffffffff));
});

test('HMAC: rechaza secretos cortos', async () => {
  await assert.rejects(() => E.deriveSeeds('corto', 'MGN-GOLD1', 12));
});

test('mkCode y cleanCode', () => {
  for (let i = 0; i < 200; i++) {
    const c = E.mkCode();
    assert.match(c, /^MGN-[A-Z0-9]{5}$/);
    assert.equal(E.cleanCode(c), c);
  }
  assert.equal(E.cleanCode(' mgn-7k2qz '), 'MGN-7K2QZ');
  assert.equal(E.cleanCode('MGN-7K2Q'), null);
  assert.equal(E.cleanCode("MGN-7K2QZ'; drop table runs"), null);
  assert.equal(E.cleanCode(null), null);
});
