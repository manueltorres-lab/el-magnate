// COPIA de /engine generada por scripts/sync-engine.mjs. No editar acá.
// El motor como reducer puro: step(state, action, cfg) => state.
// Cada handler es el del original (clase Component) con el mismo orden de consumo del RNG.
// Sin setTimeout, sin setState, sin Math.random: los giros se resuelven al instante.
import {
  BIG_SCENARIOS, COMMIT, EVENTS_AUTO, EVENTS_CHOICE, EVENTS_COND, MINI_KINDS, QUIZ, QUIZ_PCT,
  RULETA, SCENARIOS, SLOT_SYMBOLS, TAG_EFFECT, CALMA_BAJA,
} from './data.ts';
import { Rng } from './rng.ts';
import {
  bigThreshold, bonusPaciencia, clamp, computeTitleKey, drawCard, fmt, handVal, incomeFor,
  optionsFor, pctf, resolveConfig, yieldRate,
} from './rules.ts';
import type {
  Action, Card, ChoiceOption, Config, HistoryEntry, MiniState, Option, Pending, RunState, Toast,
} from './types.ts';

export class EngineError extends Error {
  code: 'out_of_phase' | 'bad_action';
  constructor(code: 'out_of_phase' | 'bad_action', message: string) {
    super(message);
    this.code = code;
  }
}

/** Apuestas que ofrece la UI (botones Poco / Medio / Fuerte del template). */
export const STAKE_FRACS = [0.05, 0.12, 0.25] as const;

export type Phase = 'result' | 'toast' | 'quiz' | 'mini' | 'eventChoice' | 'choose';

/** Qué pantalla se ve; mismo criterio que `view.isToast/isQuiz/isMini/isChoice/isScenario`. */
export function phaseOf(s: RunState): Phase {
  if (s.screen === 'result') return 'result';
  if (s.toast) return 'toast';
  if (s.quiz) return 'quiz';
  if (s.slots) return 'mini';
  if (s.evChoice) return 'eventChoice';
  return 'choose';
}

export interface NewRunInput {
  code: string;
  /** seeds[n] para n = 0..rounds (ver deriveSeeds) */
  seeds: number[];
  duelo?: boolean;
}

/** start() del original. */
export function createRun(input: NewRunInput, cfgIn: Partial<Config> = {}): RunState {
  const cfg = resolveConfig(cfgIn);
  if (input.seeds.length < cfg.rounds + 1) throw new Error('faltan semillas: se necesitan rounds + 1');
  const rng = new Rng(input.seeds[0]);
  const cuna = rng.next() < 0.01;
  const cap = cuna ? 6000000 : cfg.startingCapital;
  const rep = cuna ? 70 : 50;
  const order = rng.shuffle(SCENARIOS).slice(0, cfg.rounds);
  const miniBag = rng.shuffle(MINI_KINDS);
  const maxShow = Math.max(1, cfg.rounds - 3);
  const showRound = 1 + Math.floor(rng.next() * maxShow);
  return {
    seeds: [...input.seeds],
    rngState: rng.s,
    miniBag,
    order,
    bigUsed: [],
    showRound,
    screen: 'game',
    challenge: input.code,
    duelo: !!input.duelo,
    round: 0,
    capital: cap,
    rep,
    calma: 50,
    history: [],
    caps: [cap],
    tagCounts: {},
    riskCounts: {},
    lastTag: null,
    income: incomeFor(cfg, 0, rep),
    yieldGain: 0,
    yieldRate: 0.06,
    streak: 0,
    current: order[0],
    toast: null,
    pending: null,
    evChoice: null,
    slots: null,
    quiz: null,
    quiebra: false,
    cuna,
    showDone: false,
    roundStart: cap,
    paciencia: 0,
    paciencMax: 0,
    bonusPac: 1,
    titleKey: null,
  };
}

const bad = (msg: string) => new EngineError('bad_action', msg);
const outOfPhase = () => new EngineError('out_of_phase', 'Esa jugada no corresponde ahora.');

function intIn(v: unknown, n: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= n) throw bad('Opción inválida.');
  return v;
}

/**
 * Aplica una acción. Pura: no toca `state`, devuelve uno nuevo.
 * Tira EngineError si la acción no corresponde a la fase o el payload es inválido.
 */
export function step(state: RunState, action: Action, cfgIn: Partial<Config> = {}): RunState {
  const cfg = resolveConfig(cfgIn);
  if (!action || typeof action !== 'object' || typeof (action as { type?: unknown }).type !== 'string') {
    throw bad('Acción inválida.');
  }
  const s: RunState = structuredClone(state);
  const phase = phaseOf(s);
  const rng = new Rng(s.rngState);
  const mg = s.slots;

  switch (action.type) {
    case 'pick': {
      if (phase !== 'choose') throw outOfPhase();
      const opts = optionsFor(s);
      const opt = opts[intIn(action.option, opts.length)];
      return pick(s, opt, cfg);
    }
    case 'continue':
      if (phase !== 'toast') throw outOfPhase();
      cont(s, cfg, rng);
      break;
    case 'eventPick': {
      if (phase !== 'eventChoice') throw outOfPhase();
      const ev = s.evChoice!;
      pickEvent(s, ev.options[intIn(action.option, ev.options.length)], rng);
      break;
    }
    case 'quizAnswer': {
      const q = s.quiz;
      if (phase !== 'quiz' || !q || q.picked != null || q.over) throw outOfPhase();
      const i = intIn(action.option, q.pool[q.idx].opts.length);
      const ok = i === q.pool[q.idx].ok;
      const pot = ok ? q.pot + Math.round(q.base * QUIZ_PCT[q.idx]) : q.pot;
      const ultima = q.idx === q.pool.length - 1;
      s.quiz = { ...q, picked: i, pot, over: !ok, won: ok && ultima };
      break;
    }
    case 'quizNext': {
      const q = s.quiz;
      // la UI solo ofrece "Siguiente pregunta" si acertó y no era la última
      if (phase !== 'quiz' || !q || q.picked == null || q.over || q.won) throw outOfPhase();
      s.quiz = { ...q, idx: q.idx + 1, picked: null };
      break;
    }
    case 'quizClose': {
      const q = s.quiz;
      if (phase !== 'quiz' || !q || q.picked == null || !(q.over || q.won)) throw outOfPhase();
      cerrarQuiz(s, cfg, rng);
      break;
    }
    case 'miniStake': {
      if (phase !== 'mini' || !mg || mg.phase !== 'stake') throw outOfPhase();
      const frac = (STAKE_FRACS as readonly number[]).find((f) => f === action.frac);
      if (frac === undefined) throw bad('Apuesta inválida.');
      const stake = Math.max(10000, Math.round(s.capital * frac));
      const patch: Partial<MiniState> = { stake, phase: 'play' };
      if (mg.kind === 'doble') patch.pot = stake;
      if (mg.kind === 'sobres') patch.outcomes = rng.shuffle([Math.round(stake * 1.8), -Math.round(stake * 0.3), -stake]);
      if (mg.kind === 'blackjack') {
        patch.player = [drawCard(rng), drawCard(rng)];
        patch.dealer = [drawCard(rng), drawCard(rng)];
      }
      s.slots = { ...mg, ...patch };
      break;
    }
    case 'miniSkip':
      if (phase !== 'mini' || !mg || mg.phase !== 'stake') throw outOfPhase();
      finishMini(s, cfg, rng);
      break;
    case 'slotsSpin': {
      if (!playing(phase, mg, 'slots')) throw outOfPhase();
      const pk = () => SLOT_SYMBOLS[Math.floor(rng.next() * SLOT_SYMBOLS.length)];
      const r = [pk(), pk(), pk()];
      let delta;
      if (r[0] === r[1] && r[1] === r[2]) delta = mg!.stake * 6;
      else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) delta = mg!.stake * 0.8;
      else delta = -mg!.stake;
      applyMini(s, delta, { reels: r });
      break;
    }
    case 'ruletaSpin': {
      if (!playing(phase, mg, 'ruleta')) throw outOfPhase();
      const i = Math.floor(rng.next() * RULETA.length);
      const delta = Math.round(mg!.stake * RULETA[i].mult) - mg!.stake;
      applyMini(s, delta, { sector: i });
      break;
    }
    case 'dobleDouble': {
      if (!playing(phase, mg, 'doble')) throw outOfPhase();
      if (rng.next() < 0.5) {
        const stepN = mg!.step + 1, pot = mg!.pot * 2;
        if (stepN >= 4) applyMini(s, pot - mg!.stake, { pot, step: stepN });
        else s.slots = { ...mg!, pot, step: stepN };
      } else {
        applyMini(s, -mg!.stake, { pot: 0, step: mg!.step, bust: true });
      }
      break;
    }
    case 'dobleCashout':
      if (!playing(phase, mg, 'doble')) throw outOfPhase();
      applyMini(s, mg!.pot - mg!.stake, {});
      break;
    case 'sobreOpen': {
      if (!playing(phase, mg, 'sobres')) throw outOfPhase();
      const i = intIn(action.index, 3);
      applyMini(s, mg!.outcomes![i], { chosen: i });
      break;
    }
    case 'bjHit': {
      if (!playing(phase, mg, 'blackjack') || mg!.stood) throw outOfPhase();
      const player = [...mg!.player, drawCard(rng)];
      if (handVal(player) > 21) resolverBJ(s, player, mg!.dealer, mg!.stake);
      else s.slots = { ...mg!, player };
      break;
    }
    case 'bjStand': {
      if (!playing(phase, mg, 'blackjack') || mg!.stood) throw outOfPhase();
      const dealer = [...mg!.dealer];
      let guard = 0;
      while (handVal(dealer) < 17 && guard++ < 12) dealer.push(drawCard(rng));
      resolverBJ(s, mg!.player, dealer, mg!.stake);
      break;
    }
    case 'miniFinish':
      if (phase !== 'mini' || !mg || !mg.done) throw outOfPhase();
      finishMini(s, cfg, rng);
      break;
    default:
      throw bad('Acción desconocida.');
  }
  s.rngState = rng.s;
  return s;
}

function playing(phase: Phase, mg: MiniState | null, kind: MiniState['kind']): boolean {
  return phase === 'mini' && !!mg && mg.kind === kind && mg.phase === 'play' && !mg.done;
}

/** pick(opt) del original. Re-siembra con seeds[round + 1]. */
function pick(s: RunState, opt: Option, cfg: Config): RunState {
  const rng = new Rng(s.seeds[s.round + 1]);
  const eff = TAG_EFFECT[opt.tag] || { rep: 0, calma: 0 };
  let rep = clamp(s.rep + eff.rep), calma = clamp(s.calma + eff.calma);
  let delta: number, note: string;
  if (opt.spend) {
    delta = -Math.round(s.capital * 0.09);
    note = 'Te diste un gusto. La plata se fue, la cabeza descansó.';
  } else {
    const stake = s.capital * COMMIT[opt.risk];
    const pct = rng.range(opt.min!, opt.max!);
    delta = stake * (pct / 100);
    note = 'Comprometiste ' + fmt(stake) + ' y el resultado fue ' + pctf(pct) + '.';
    if (delta > 0) {
      delta *= 1 + (rep - 50) / 250;
      const shown = Math.round((rep - 50) / 2.5);
      if ((rep >= 60 || rep <= 40) && shown !== 0) {
        note += ' Tu reputación ' + (shown > 0 ? 'sumó un ' : 'restó un ') + Math.abs(shown) + '%.';
      }
      if (s.streak >= 2) { delta *= 1.6; note += ' Venís con racha: ×1,6 sobre la ganancia.'; }
    } else if (delta < 0) {
      if (calma < 25) { delta *= 1.3; note += ' Estás quemado: la pérdida pegó un 30% más fuerte.'; }
      else if (calma > 75) { delta *= 0.85; note += ' Con la cabeza fría cortaste la pérdida un 15%.'; }
      if (opt.risk === 'alta') {
        rep = clamp(rep - 5);
        note += ' Fallar en grande se ve: perdiste 5 de reputación.';
      }
    }
  }
  const streak = delta > 0 ? s.streak + 1 : 0;
  let capital = Math.max(0, s.capital + delta);

  const tagCounts = { ...s.tagCounts }; tagCounts[opt.tag] = (tagCounts[opt.tag] || 0) + 1;
  const riskCounts = { ...s.riskCounts }; riskCounts[opt.risk] = (riskCounts[opt.risk] || 0) + 1;
  const history: HistoryEntry[] = [...s.history, { icon: opt.icon, label: opt.label, tag: opt.tag, risk: opt.risk, delta, round: s.round }];

  let pending: Pending | null = null, slots: MiniState | null = null;
  let evFired: Toast['evFired'] = null, evDelta: number | null = null;
  let showDone = s.showDone;
  if (!s.showDone && s.round >= s.showRound) {
    pending = { type: 'quiz', pool: rng.shuffle(QUIZ).slice(0, 3) };
    showDone = true;
  } else if (rng.next() < cfg.eventChance) {
    const roll = rng.next();
    if (roll < 0.28) {
      pending = { type: 'choice', ev: EVENTS_CHOICE[Math.floor(rng.next() * EVENTS_CHOICE.length)] };
    } else if (roll < 0.62 && (cfg.minigame ?? true)) {
      pending = { type: 'mini' };
      slots = makeMini(s, capital, rng);
    } else {
      const mios = EVENTS_COND.filter((e) => e.cond === opt.tag);
      const pool = (mios.length && rng.next() < 0.35) ? mios : EVENTS_AUTO;
      const ev = pool[Math.floor(rng.next() * pool.length)];
      evDelta = ev.fixedAdd !== undefined ? ev.fixedAdd : capital * (ev.pct! / 100);
      capital = Math.max(0, capital + evDelta);
      if (ev.calma) calma = clamp(calma + ev.calma);
      evFired = ev;
    }
  }
  const out: RunState = {
    ...s, capital, rep, calma, tagCounts, riskCounts, history, lastTag: opt.tag, streak,
    pending, slots, evChoice: null, showDone,
    toast: {
      label: delta >= 0 ? 'Sumaste' : 'Perdiste', amount: fmt(delta), pos: delta >= 0, note,
      rep: rep - s.rep, calma: calma - s.calma, evFired, evDelta,
    },
  };
  out.rngState = rng.s;
  return out;
}

/** makeMini(capital). Ojo: usa la cabeza de ANTES del pick, como el original (lee this.state). */
function makeMini(s: RunState, capital: number, rng: Rng): MiniState {
  const pico = Math.max(capital, ...(s.caps.length ? s.caps : [capital]));
  const apurado = capital < 400000 || (pico > 0 && 1 - capital / pico >= 0.45) || s.calma < CALMA_BAJA;
  let kind: MiniState['kind'];
  if (apurado && rng.next() < 0.5) {
    kind = 'blackjack';
  } else {
    if (!s.miniBag || !s.miniBag.length) s.miniBag = rng.shuffle(MINI_KINDS);
    kind = s.miniBag.shift()!;
  }
  return {
    kind, phase: 'stake', stake: 0, pot: 0, step: 0, done: false, delta: 0,
    reels: null, outcomes: null, chosen: null, sector: null,
    player: [], dealer: [], stood: false, bust: false, resultado: '',
  };
}

function pickEvent(s: RunState, o: ChoiceOption, rng: Rng): void {
  const pct = rng.range(o.min, o.max);
  const delta = s.capital * COMMIT.media * (pct / 100);
  const flat = Math.abs(delta) < 1;
  s.capital = Math.max(0, s.capital + delta);
  s.rep = clamp(s.rep + (o.rep || 0));
  s.calma = clamp(s.calma + (o.calma || 0));
  s.evChoice = null;
  s.pending = { type: 'done' };
  s.toast = {
    label: flat ? 'No moviste plata' : (delta >= 0 ? 'El evento te dejó' : 'El evento te costó'),
    amount: flat ? 'Sin cambios' : fmt(delta), pos: delta >= 0,
    note: flat ? 'La plata quedó donde estaba. Lo que se movió fue otra cosa.'
      : 'Resultado del evento: ' + pctf(pct) + ' sobre lo expuesto.',
    rep: o.rep || 0, calma: o.calma || 0, evFired: null, evDelta: null,
  };
}

function cont(s: RunState, cfg: Config, rng: Rng): void {
  const p = s.pending;
  if (p && p.type === 'quiz') {
    s.toast = null;
    s.pending = { type: 'done' };
    s.quiz = { pool: p.pool, idx: 0, picked: null, pot: 0, base: s.capital, over: false, won: false };
    return;
  }
  if (p && p.type === 'choice') { s.toast = null; s.evChoice = p.ev; s.pending = { type: 'done' }; return; }
  if (p && p.type === 'mini') { s.toast = null; s.pending = { type: 'miniOpen' }; return; }
  next(s, cfg, rng);
}

function cerrarQuiz(s: RunState, cfg: Config, rng: Rng): void {
  const q = s.quiz;
  let delta = 0, rep = 0, calma = 0;
  if (q) {
    if (q.won) { delta = q.pot + Math.round(q.base * 0.05); rep = 6; calma = 6; }
    else { delta = -Math.round(q.base * 0.07); rep = -1; calma = -4; }
  }
  s.quiz = null;
  s.pending = null;
  s.capital = Math.max(0, s.capital + delta);
  s.rep = clamp(s.rep + rep);
  s.calma = clamp(s.calma + calma);
  next(s, cfg, rng);
}

function applyMini(s: RunState, delta: number, patch: Partial<MiniState>): void {
  s.capital = Math.max(0, s.capital + delta);
  s.slots = { ...s.slots!, ...patch, delta, done: true };
}

function resolverBJ(s: RunState, player: Card[], dealer: Card[], stake: number): void {
  const pv = handVal(player), dv = handVal(dealer);
  const bjJugador = pv === 21 && player.length === 2;
  let delta: number, resultado: string;
  if (pv > 21) { delta = -stake; resultado = 'Te pasaste de 21.'; }
  else if (bjJugador && dv !== 21) { delta = Math.round(stake * 1.5); resultado = 'Blackjack. Paga 1,5 a 1.'; }
  else if (dv > 21) { delta = stake; resultado = 'Se pasó la banca.'; }
  else if (pv > dv) { delta = stake; resultado = 'Le ganaste a la banca, ' + pv + ' a ' + dv + '.'; }
  else if (pv === dv) { delta = 0; resultado = 'Empate, ' + pv + ' iguales. Te devuelven todo.'; }
  else { delta = -stake; resultado = 'Ganó la banca, ' + dv + ' a ' + pv + '.'; }
  applyMini(s, delta, { stood: true, player, dealer, resultado, bust: pv > 21 });
}

function finishMini(s: RunState, cfg: Config, rng: Rng): void {
  s.slots = null;
  s.pending = null;
  next(s, cfg, rng);
}

/** next() del original: cierre de ronda, ingreso, rendimiento, grandes ligas o final. */
function next(s: RunState, cfg: Config, rng: Rng): void {
  const caps = [...s.caps, s.capital];
  const paciencia = s.capital >= s.roundStart ? s.paciencia + 1 : 0;
  const paciencMax = Math.max(s.paciencMax, paciencia);
  const clear = { toast: null, pending: null, slots: null, evChoice: null, quiz: null };
  if (s.capital < 40000) {
    Object.assign(s, { caps, paciencia: 0, paciencMax, bonusPac: 1, screen: 'result', quiebra: true, ...clear });
    s.titleKey = computeTitleKey(s);
    return;
  }
  const round = s.round + 1;
  if (round >= cfg.rounds) {
    const bonusPac = bonusPaciencia(paciencMax);
    Object.assign(s, { caps, paciencia, paciencMax, bonusPac, capital: Math.round(s.capital * bonusPac), screen: 'result', ...clear });
    s.titleKey = computeTitleKey(s);
    return;
  }
  const inc = incomeFor(cfg, round, s.rep);
  const yRate = yieldRate(s);
  const yieldGain = Math.round(s.capital * yRate);
  const capital = s.capital + inc + yieldGain;

  let current = s.order[round], bigUsed = s.bigUsed;
  if (capital >= bigThreshold(s.rep)) {
    const free = BIG_SCENARIOS.filter((_, i) => !s.bigUsed.includes(i));
    if (free.length && rng.next() < 0.7) {
      const idx = BIG_SCENARIOS.indexOf(free[Math.floor(rng.next() * free.length)]);
      current = BIG_SCENARIOS[idx];
      bigUsed = [...s.bigUsed, idx];
    }
  }
  Object.assign(s, {
    round, caps, capital, paciencia, paciencMax, roundStart: capital,
    income: inc, yieldGain, yieldRate: yRate, current, bigUsed, ...clear,
  });
}
