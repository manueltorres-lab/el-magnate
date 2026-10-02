// COPIA de /engine generada por scripts/sync-engine.mjs. No editar acá.
// toView(state): lo único que se le muestra al jugador. Se arma campo por campo;
// nunca se serializa el estado entero. Todo lo que no esté acá, no sale.
import { COMMIT, QUIZ_PCT, RAREZA, TITLES } from './data.ts';
import { bigThreshold, bonusPaciencia, cardVal, handVal, incomeFor, optionsFor, resolveConfig } from './rules.ts';
import { phaseOf, STAKE_FRACS, type Phase } from './step.ts';
import type { Card, Config, MiniKind, Risk, RunState, Tag, TitleKey } from './types.ts';

export interface OptionView {
  label: string;
  desc: string;
  icon: string;
  risk: Risk;
  spend: boolean;
  extra: 'ahogado' | 'fina' | null;
  /** monto que se compromete (o se gasta, si `spend`): lo muestra la UI como "Comprometés $X" */
  stake: number;
  /** la UI marca la opción si el peor caso te deja al borde de fundirte */
  puedeFundir: boolean;
}

export type CardView = Card | { hidden: true };

export interface MiniView {
  kind: MiniKind;
  phase: 'stake' | 'play';
  done: boolean;
  stake: number;
  delta: number;
  stakeOptions: { frac: number; amount: number }[];
  // doble
  pot: number;
  step: number;
  bust: boolean;
  // slots
  reels: string[] | null;
  // ruleta
  sector: number | null;
  // sobres: los tres montos se ven recién al abrir uno
  outcomes: number[] | null;
  chosen: number | null;
  // blackjack
  player: Card[];
  playerVal: number | null;
  dealer: CardView[];
  /** valor visible de la banca: el total al plantarse, si no solo la primera carta */
  dealerVal: number | null;
  dealerHidden: boolean;
  stood: boolean;
  resultado: string;
}

export interface QuizView {
  idx: number;
  total: number;
  q: string;
  opts: string[];
  picked: number | null;
  pot: number;
  base: number;
  over: boolean;
  won: boolean;
  /** montos acumulados de la escalera P1..P3 (el último incluye el premio del estudio) */
  ladder: number[];
  /** solo después de responder */
  ok: number | null;
  why: string | null;
}

export interface FinalView {
  titleKey: TitleKey;
  title: string;
  icon: string;
  blurb: string;
  rareza: number;
  capital: number;
  challenge: string;
  quiebra: boolean;
  decisiones: number;
  jugadasRiesgo: number;
}

export interface GameView {
  screen: 'game' | 'result';
  phase: Phase;
  round: number;
  rounds: number;
  capital: number;
  startingCapital: number;
  rep: number;
  calma: number;
  caps: number[];
  history: { icon: string; label: string; tag: Tag; risk: Risk; delta: number; round: number }[];
  /** ingreso de la ronda actual con la reputación actual (el panel lo recalcula en vivo) */
  income: number;
  yieldGain: number;
  yieldRate: number;
  streak: number;
  paciencia: number;
  paciencMax: number;
  /** multiplicador de paciencia que tendrías al cierre con la racha actual */
  pacienciaBonus: number;
  bonusPac: number;
  cuna: boolean;
  /** vacío hasta el final: con el código se juega la misma partida como duelo y se puede explorar desde otra cuenta */
  challenge: string;
  duelo: boolean;
  bigThreshold: number;
  /** top 4 de perfiles jugados, para el panel "Tus posiciones" */
  positions: { tag: Tag; n: number }[];
  current: { icon: string; eyebrow: string; text: string; detail: string; options: OptionView[] } | null;
  toast: null | {
    label: string; amount: string; pos: boolean; note: string; rep: number; calma: number;
    evFired: { icon: string; text: string } | null; evDelta: number | null;
    /** el próximo paso es El Sillón */
    vieneShow: boolean;
  };
  evChoice: null | { icon: string; eyebrow: string; text: string; detail: string; options: { label: string; desc: string; icon: string }[] };
  quiz: QuizView | null;
  mini: MiniView | null;
  final: FinalView | null;
}

export function toView(s: RunState, cfgIn: Partial<Config> = {}): GameView {
  const cfg = resolveConfig(cfgIn);
  const phase = phaseOf(s);

  // Los empates se ordenan por el primer pick de cada perfil: es el orden de inserción en
  // tagCounts que usa el original, y no depende del orden de claves (jsonb lo reordena).
  const firstSeen: Tag[] = [];
  for (const h of s.history) if (!firstSeen.includes(h.tag)) firstSeen.push(h.tag);
  const positions = firstSeen
    .map((tag) => [tag, s.tagCounts[tag] || 0] as [Tag, number])
    .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([tag, n]) => ({ tag, n }));

  let current: GameView['current'] = null;
  if (phase === 'choose') {
    const sc = s.current;
    current = {
      icon: sc.icon, eyebrow: sc.eyebrow, text: sc.text, detail: sc.detail,
      options: optionsFor(s).map((o) => ({
        label: o.label, desc: o.desc, icon: o.icon, risk: o.risk, spend: !!o.spend, extra: o.extra ?? null,
        stake: o.spend ? s.capital * 0.09 : s.capital * COMMIT[o.risk],
        puedeFundir: !o.spend && (o.min as number) < 0
          && (s.capital + s.capital * COMMIT[o.risk] * ((o.min as number) / 100)) < 120000,
      })),
    };
  }

  const t = s.toast;
  const toast: GameView['toast'] = t ? {
    label: t.label, amount: t.amount, pos: t.pos, note: t.note, rep: t.rep, calma: t.calma,
    evFired: t.evFired ? { icon: t.evFired.icon, text: t.evFired.text } : null,
    evDelta: t.evDelta,
    vieneShow: !!(s.pending && s.pending.type === 'quiz'),
  } : null;

  const ev = phase === 'eventChoice' ? s.evChoice : null;
  const evChoice: GameView['evChoice'] = ev ? {
    icon: ev.icon, eyebrow: ev.eyebrow, text: ev.text, detail: ev.detail,
    options: ev.options.map((o) => ({ label: o.label, desc: o.desc, icon: o.icon })),
  } : null;

  let quiz: QuizView | null = null;
  if (phase === 'quiz' && s.quiz) {
    const q = s.quiz, cur = q.pool[q.idx], answered = q.picked != null;
    const ladder: number[] = [];
    for (let i = 0; i < q.pool.length; i++) {
      let monto = 0;
      for (let k = 0; k <= i; k++) monto += Math.round(q.base * QUIZ_PCT[k]);
      if (i === q.pool.length - 1) monto += Math.round(q.base * 0.05);
      ladder.push(monto);
    }
    quiz = {
      idx: q.idx, total: q.pool.length, q: cur.q, opts: [...cur.opts], picked: q.picked,
      pot: q.pot, base: q.base, over: q.over, won: q.won, ladder,
      ok: answered ? cur.ok : null,
      why: answered ? cur.why : null,
    };
  }

  let mini: MiniView | null = null;
  if (phase === 'mini' && s.slots) {
    const m = s.slots;
    const reveal = m.stood || m.done;
    mini = {
      kind: m.kind, phase: m.phase, done: m.done, stake: m.stake, delta: m.delta,
      stakeOptions: m.phase === 'stake' ? STAKE_FRACS.map((frac) => ({ frac, amount: s.capital * frac })) : [],
      pot: m.pot, step: m.step, bust: m.bust,
      reels: m.reels ? [...m.reels] : null,
      sector: m.done ? m.sector : null,
      outcomes: m.done && m.outcomes ? [...m.outcomes] : null,
      chosen: m.chosen,
      player: m.player.map((c) => ({ ...c })),
      playerVal: m.player.length ? handVal(m.player) : null,
      dealer: m.dealer.map((c, i) => (i > 0 && !reveal ? { hidden: true as const } : { ...c })),
      dealerVal: m.dealer.length ? (reveal ? handVal(m.dealer) : cardVal(m.dealer[0].r)) : null,
      dealerHidden: m.dealer.length > 0 && !reveal,
      stood: m.stood,
      resultado: m.resultado,
    };
  }

  let final: FinalView | null = null;
  if (s.screen === 'result' && s.titleKey) {
    const T = TITLES[s.titleKey];
    final = {
      titleKey: s.titleKey, title: T.title, icon: T.icon, blurb: T.blurb, rareza: RAREZA[s.titleKey],
      capital: s.capital, challenge: s.challenge, quiebra: s.quiebra,
      decisiones: s.history.length, jugadasRiesgo: s.riskCounts.alta || 0,
    };
  }

  return {
    screen: s.screen, phase, round: s.round, rounds: cfg.rounds, capital: s.capital,
    startingCapital: cfg.startingCapital,
    rep: s.rep, calma: s.calma, caps: [...s.caps],
    history: s.history.map((h) => ({ icon: h.icon, label: h.label, tag: h.tag, risk: h.risk, delta: h.delta, round: h.round })),
    income: incomeFor(cfg, s.round, s.rep), yieldGain: s.yieldGain, yieldRate: s.yieldRate, streak: s.streak,
    paciencia: s.paciencia, paciencMax: s.paciencMax, pacienciaBonus: bonusPaciencia(s.paciencia), bonusPac: s.bonusPac,
    cuna: s.cuna, challenge: s.screen === 'result' ? s.challenge : '', duelo: s.duelo, bigThreshold: bigThreshold(s.rep),
    positions, current, toast, evChoice, quiz, mini, final,
  };
}
