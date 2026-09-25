// Reglas puras del juego, portadas 1:1 de la clase Component del original.
import {
  BIG_THRESHOLD, CALMA_ALTA, CALMA_BAJA, DESESPERADAS, FINAS, FIRMA_MIN, FIRMA_SCORE,
  TAG_FINAL, TAG_PESO,
} from './data.ts';
import type { Card, Config, Option, RunState, Tag, TitleKey } from './types.ts';
import type { Rng } from './rng.ts';
import { CARD_R, CARD_S } from './data.ts';

export const DEFAULT_CONFIG: Config = {
  rounds: 12,
  startingCapital: 500000,
  eventChance: 0.55,
  incomeBase: 260000,
  minigame: true,
};

/** Completa la config con los defaults del motor y acota `rounds` a 6–20 como el original. */
export function resolveConfig(partial: Partial<Config> = {}): Config {
  const c = { ...DEFAULT_CONFIG };
  for (const k of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
    const v = partial[k];
    if (v !== undefined && v !== null) (c as Record<string, unknown>)[k] = v;
  }
  c.rounds = Math.max(6, Math.min(20, c.rounds));
  return c;
}

export const clamp = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

/** Formato rioplatense: $1.234.567. Se usa en los textos que arma el motor (notas del resultado). */
export const fmt = (n: number): string => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('es-AR');
export const pctf = (n: number, d?: number): string =>
  (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(d === undefined ? 1 : d).replace('.', ',') + '%';

export function incomeFor(cfg: Config, r: number, rep: number): number {
  return Math.round(cfg.incomeBase * (1 + 0.55 * r) * (1 + (rep - 50) / 180));
}

export function yieldRate(s: Pick<RunState, 'riskCounts' | 'calma'>): number {
  return 0.06 + 0.009 * (s.riskCounts.baja || 0) + (s.calma > CALMA_ALTA ? 0.02 : 0);
}

export function bonusPaciencia(n: number): number {
  return n < 4 ? 1 : +Math.pow(1.155, n - 3).toFixed(3);
}

export function bigThreshold(rep: number): number {
  return Math.max(9000000, Math.round(BIG_THRESHOLD - (rep - 50) * 120000));
}

export const cardVal = (r: string): number => (r === 'A' ? 11 : (['J', 'Q', 'K', '10'].includes(r) ? 10 : +r));

export const drawCard = (rng: Rng): Card => ({
  r: CARD_R[Math.floor(rng.next() * 13)],
  s: CARD_S[Math.floor(rng.next() * 4)],
});

export function handVal(h: readonly Card[]): number {
  let v = h.reduce((a, c) => a + cardVal(c.r), 0), as = h.filter((c) => c.r === 'A').length;
  while (v > 21 && as > 0) { v -= 10; as--; }
  return v;
}

/** Opciones de la ronda tal como se muestran: las del escenario + la 4ª según la cabeza. */
export function optionsFor(s: Pick<RunState, 'current' | 'calma' | 'round'>): Option[] {
  let pool = s.current.options || [];
  if (s.calma < CALMA_BAJA) pool = [...pool, DESESPERADAS[s.round % DESESPERADAS.length]];
  else if (s.calma > CALMA_ALTA) pool = [...pool, FINAS[s.round % FINAS.length]];
  return pool;
}

/** computeTitle() del original, devolviendo la clave del final. El orden importa. */
export function computeTitleKey(s: Pick<RunState, 'tagCounts' | 'riskCounts' | 'capital' | 'cuna' | 'quiebra' | 'calma' | 'rep'>): TitleKey {
  const tc = s.tagCounts, rc = s.riskCounts, cap = s.capital;
  if (cap >= 500000000) return 'imperio';
  if (s.cuna && (s.quiebra || cap < 15000000)) return 'servido';
  if (s.quiebra) return 'quiebra';
  if (cap >= 100000000 && s.calma < 15) return 'insomne';
  if (cap >= 100000000) return 'magnate';
  if (cap < 2500000) return 'perdido';
  if ((rc.alta || 0) >= 9) return 'temerario';
  if (cap >= 50000000) return 'independencia';
  // firma: cuánto te desviaste de lo que el banco te venía ofreciendo
  const firma = (Object.keys(TAG_FINAL) as Tag[])
    .filter((t) => (tc[t] || 0) >= FIRMA_MIN)
    .map((t) => [TAG_FINAL[t] as TitleKey, (tc[t] || 0) / TAG_PESO[t]] as const)
    .sort((a, b) => b[1] - a[1]);
  if (firma.length && firma[0][1] >= FIRMA_SCORE) return firma[0][0];
  if (s.rep >= 78) return 'referente';
  if (cap < 10000000) return 'zafando';
  return 'deberes';
}
