// Tipos del motor de El Magnate. Sin dependencias: corre igual en Deno y en Node.

export type Tag =
  | 'conservative' | 'moderate' | 'aggressive' | 'business' | 'debt'
  | 'realestate' | 'education' | 'networking' | 'philanthropy' | 'consumption';

export type Risk = 'baja' | 'media' | 'alta';

export type TitleKey =
  | 'imperio' | 'quiebra' | 'insomne' | 'generoso' | 'estudioso' | 'temerario' | 'disfruton'
  | 'referente' | 'magnate' | 'independencia' | 'constructor' | 'zafando' | 'servido'
  | 'ladrillo' | 'equilibrista' | 'emprendedor' | 'deberes' | 'pulso' | 'perdido';

export interface Option {
  label: string;
  icon: string;
  tag: Tag;
  risk: Risk;
  min?: number;
  max?: number;
  spend?: boolean;
  desc: string;
  extra?: 'ahogado' | 'fina';
}

export interface Scenario {
  icon: string;
  eyebrow: string;
  text: string;
  detail: string;
  options: Option[];
}

export interface AutoEvent {
  text: string;
  icon: string;
  pct?: number;
  fixedAdd?: number;
  calma?: number;
  cond?: Tag;
}

export interface ChoiceOption {
  label: string;
  icon: string;
  desc: string;
  min: number;
  max: number;
  rep?: number;
  calma?: number;
}

export interface ChoiceEvent {
  icon: string;
  eyebrow: string;
  text: string;
  detail: string;
  options: ChoiceOption[];
}

export interface QuizQuestion {
  q: string;
  opts: string[];
  ok: number;
  why: string;
}

export interface Title {
  title: string;
  icon: string;
  blurb: string;
}

export type BagMiniKind = 'slots' | 'doble' | 'sobres' | 'ruleta';
export type MiniKind = BagMiniKind | 'blackjack';

export interface Card {
  r: string;
  s: string;
}

export interface HistoryEntry {
  icon: string;
  label: string;
  tag: Tag;
  risk: Risk;
  delta: number;
  round: number;
}

export interface Toast {
  label: string;
  amount: string;
  pos: boolean;
  note: string;
  rep: number;
  calma: number;
  evFired: AutoEvent | null;
  evDelta: number | null;
}

export type Pending =
  | { type: 'quiz'; pool: QuizQuestion[] }
  | { type: 'choice'; ev: ChoiceEvent }
  | { type: 'mini' }
  | { type: 'miniOpen' }
  | { type: 'done' };

export interface QuizState {
  pool: QuizQuestion[];
  idx: number;
  picked: number | null;
  pot: number;
  base: number;
  over: boolean;
  won: boolean;
}

/** Estado del minijuego (en el original, `state.slots`). Sin los campos de animación. */
export interface MiniState {
  kind: MiniKind;
  phase: 'stake' | 'play';
  stake: number;
  pot: number;
  step: number;
  done: boolean;
  delta: number;
  reels: string[] | null;
  outcomes: number[] | null;
  chosen: number | null;
  sector: number | null;
  player: Card[];
  dealer: Card[];
  stood: boolean;
  bust: boolean;
  resultado: string;
}

export interface Config {
  rounds: number;
  startingCapital: number;
  eventChance: number;
  incomeBase: number;
  minigame: boolean;
}

/** Estado completo de una partida. Vive solo en el servidor: al cliente sale `toView(state)`. */
export interface RunState {
  // ---- secreto / interno: nunca sale del servidor ----
  /** semillas del RNG: seeds[n] = u32(HMAC(SERVER_SECRET, code|n)). n = 0 al empezar, round+1 en cada pick. */
  seeds: number[];
  /** estado del xorshift32, persistido entre acciones */
  rngState: number;
  miniBag: BagMiniKind[];
  order: Scenario[];
  bigUsed: number[];
  showRound: number;

  // ---- partida ----
  screen: 'game' | 'result';
  challenge: string;
  duelo: boolean;
  round: number;
  capital: number;
  rep: number;
  calma: number;
  history: HistoryEntry[];
  caps: number[];
  tagCounts: Partial<Record<Tag, number>>;
  riskCounts: Partial<Record<Risk, number>>;
  lastTag: Tag | null;
  income: number;
  yieldGain: number;
  yieldRate: number;
  streak: number;
  current: Scenario;
  toast: Toast | null;
  pending: Pending | null;
  evChoice: ChoiceEvent | null;
  slots: MiniState | null;
  quiz: QuizState | null;
  quiebra: boolean;
  cuna: boolean;
  showDone: boolean;
  roundStart: number;
  paciencia: number;
  paciencMax: number;
  bonusPac: number;
  /** clave del final, solo cuando screen === 'result' */
  titleKey: TitleKey | null;
}

export type StakeFrac = 0.05 | 0.12 | 0.25;

/** Lo único que el cliente puede mandar. */
export type Action =
  | { type: 'pick'; option: number }
  | { type: 'continue' }
  | { type: 'eventPick'; option: number }
  | { type: 'quizAnswer'; option: number }
  | { type: 'quizNext' }
  | { type: 'quizClose' }
  | { type: 'miniStake'; frac: number }
  | { type: 'miniSkip' }
  | { type: 'slotsSpin' }
  | { type: 'ruletaSpin' }
  | { type: 'dobleDouble' }
  | { type: 'dobleCashout' }
  | { type: 'sobreOpen'; index: number }
  | { type: 'bjHit' }
  | { type: 'bjStand' }
  | { type: 'miniFinish' };

export type ActionType = Action['type'];
