// Paridad: con la semilla vieja (hashStr), el motor portado da EXACTAMENTE lo mismo que
// el código original para las mismas acciones. El original corre en Node, extraído de
// <script data-dc-script> de handoff/referencia/El Magnate.dc.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadOriginal } from '../../scripts/original.mjs';
import * as E from '../index.ts';
import type { Action, Config, RunState } from '../types.ts';
import { codeFrom, mulberry32 } from './helpers.ts';

const orig = loadOriginal();

const GAME_KEYS = [
  'screen', 'round', 'capital', 'rep', 'calma', 'history', 'caps', 'tagCounts', 'riskCounts', 'lastTag',
  'income', 'yieldGain', 'yieldRate', 'streak', 'current', 'bigUsed', 'toast', 'pending', 'evChoice', 'quiz',
  'quiebra', 'cuna', 'showRound', 'showDone', 'roundStart', 'paciencia', 'paciencMax', 'bonusPac',
  'challenge', 'order',
] as const;
const MINI_KEYS = [
  'kind', 'phase', 'stake', 'pot', 'step', 'done', 'delta', 'reels', 'outcomes', 'chosen', 'sector',
  'player', 'dealer', 'stood', 'bust', 'resultado',
] as const;

// deno-lint-ignore no-explicit-any
type Any = any;

function project(s: Any, extra: { miniBag: unknown; rng: number; titleKey: unknown }) {
  const o: Record<string, unknown> = {};
  for (const k of GAME_KEYS) o[k] = s[k];
  o.slots = s.slots ? Object.fromEntries(MINI_KEYS.map((k) => [k, s.slots[k]])) : null;
  Object.assign(o, extra);
  return JSON.parse(JSON.stringify(o));
}

function firstDiff(a: Any, b: Any, path = ''): string | null {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDiff(a[k], b[k], path + '.' + k);
      if (d) return d;
    }
  }
  return `${path}: original=${JSON.stringify(a)} motor=${JSON.stringify(b)}`;
}

/** Aplica la acción en el original, por los mismos caminos que la UI. */
function applyOriginal(g: Any, a: Action) {
  switch (a.type) {
    case 'pick': return g.renderVals().options[a.option].pick();
    case 'continue': return g.cont();
    case 'eventPick': return g.renderVals().evOptions[a.option].pick();
    case 'quizAnswer': return g.renderVals().quiz.opts[a.option].pick();
    case 'quizNext': return g.seguirQuiz();
    case 'quizClose': return g.cerrarQuiz();
    case 'miniStake': return g.setStake(a.frac);
    case 'miniSkip': return g.pasarMini();
    case 'slotsSpin': g.spin(); return orig.flush();
    case 'ruletaSpin': g.girarRuleta(); return orig.flush();
    case 'dobleDouble': return g.doblar();
    case 'dobleCashout': return g.retirar();
    case 'sobreOpen': return g.abrirSobre(a.index);
    case 'bjHit': return g.pedirCarta();
    case 'bjStand': return g.plantarse();
    case 'miniFinish': return g.finishMini();
  }
}

function playBoth(code: string, cfg: Partial<Config>, rand: () => number): { actions: number; final: RunState } {
  const g: Any = orig.newGame(cfg);
  g.setState({ duelo: code });
  g.start();
  const rounds = E.resolveConfig(cfg).rounds;
  let s: RunState = E.createRun({ code, seeds: E.legacySeeds(code, rounds) }, cfg);

  const check = (label: string) => {
    const a = project(g.state, {
      miniBag: g.miniBag, rng: orig.api.getR(),
      titleKey: g.state.screen === 'result' ? g.titleKey() : null,
    });
    const b = project(s, { miniBag: s.miniBag, rng: s.rngState, titleKey: s.titleKey });
    const d = firstDiff(a, b);
    if (d) assert.fail(`${code} ${label}: ${d}`);
  };
  check('start');

  let n = 0;
  while (s.screen !== 'result') {
    const acts = E.validActions(E.toView(s, cfg));
    assert.ok(acts.length > 0, 'sin acciones válidas en fase ' + E.phaseOf(s));
    const a = acts[Math.floor(rand() * acts.length)];
    applyOriginal(g, a);
    // simula la persistencia en jsonb entre acciones
    s = JSON.parse(JSON.stringify(E.step(s, a, cfg)));
    check(`acción ${++n} ${JSON.stringify(a)}`);
    assert.ok(n < 500, 'la partida no termina');
  }
  return { actions: n, final: s };
}

test('los datos del motor son idénticos a los del original', () => {
  const names = [
    'SCENARIOS', 'BIG_SCENARIOS', 'EVENTS_AUTO', 'EVENTS_COND', 'EVENTS_CHOICE', 'QUIZ', 'TITLES', 'RAREZA',
    'DESESPERADAS', 'FINAS', 'TAG_EFFECT', 'COMMIT', 'TAG_PESO', 'TAG_FINAL', 'ORDEN_COL', 'MINI_KINDS',
    'RULETA', 'SLOT_SYMBOLS', 'QUIZ_PCT', 'TAG_LABEL', 'CARD_R', 'CARD_S',
  ] as const;
  for (const k of names) {
    assert.equal(JSON.stringify((E as Any)[k]), JSON.stringify(orig.api[k]), k);
  }
});

test('hashStr y la semilla vieja coinciden con el original', () => {
  for (const code of ['MGN-AAAAA', 'MGN-7K2QZ', 'hola']) {
    for (let n = 0; n < 21; n++) {
      orig.api.seedAt(code, n);
      assert.equal(E.legacySeed(code, n), orig.api.getR());
      assert.equal(E.hashStr(code + '|' + n), orig.api.hashStr(code + '|' + n));
    }
  }
});

test('paridad: 600 partidas con acciones al azar, config por defecto', () => {
  const rand = mulberry32(20240901);
  const finals = new Set<string>();
  let actions = 0;
  for (let i = 0; i < 600; i++) {
    const r = playBoth(codeFrom(rand), {}, rand);
    actions += r.actions;
    finals.add(r.final.titleKey!);
  }
  assert.ok(actions > 600 * 20, 'se ejercitaron pocas acciones');
  assert.ok(finals.size >= 8, 'se cubrieron pocos finales: ' + [...finals].join(','));
});

test('paridad: configs alternativas (rondas, eventos, sin minijuegos)', () => {
  const rand = mulberry32(777);
  const cfgs: Partial<Config>[] = [
    { rounds: 6 }, { rounds: 20 }, { eventChance: 1 }, { eventChance: 0 }, { minigame: false },
    { startingCapital: 100000, incomeBase: 50000 }, { startingCapital: 5000000, incomeBase: 800000, eventChance: 0.9 },
  ];
  for (const cfg of cfgs) {
    for (let i = 0; i < 60; i++) playBoth(codeFrom(rand), cfg, rand);
  }
});

test('paridad: estrategias sesgadas (siempre la primera / la última opción)', () => {
  const rand = mulberry32(99);
  for (const pickLast of [false, true]) {
    for (let i = 0; i < 150; i++) {
      // sesgo: siempre el extremo en la lista de acciones, salvo 20% al azar
      const biased = () => {
        const r = rand();
        return r < 0.2 ? rand() : (pickLast ? 0.9999 : 0);
      };
      playBoth(codeFrom(rand), {}, biased);
    }
  }
});
