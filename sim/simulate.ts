// Simulación de partidas completas con el motor, usando semillas HMAC como en producción.
import * as E from '../engine/index.ts';
import type { Config, RunState, TitleKey } from '../engine/types.ts';
import { makeBot, type BotName } from './bots.ts';

export const SIM_SECRET = 'sim-secret-solo-para-simulaciones-0123456789';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GameResult {
  capital: number;
  titleKey: TitleKey;
  quiebra: boolean;
  actions: number;
  maxRep: number;
  finalRep: number;
}

const CHAR = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function simulate(bot: BotName, games: number, seed: number, cfg: Partial<Config> = {},
  onStep?: (s: RunState) => void): Promise<GameResult[]> {
  const rand = mulberry32(seed);
  const key = await E.importSecret(SIM_SECRET);
  const rounds = E.resolveConfig(cfg).rounds;
  const out: GameResult[] = [];
  for (let g = 0; g < games; g++) {
    let code = 'MGN-';
    for (let i = 0; i < 5; i++) code += CHAR[Math.floor(rand() * CHAR.length)];
    // un código por partida y un "nonce" por índice: así no se repiten semillas entre partidas
    const seeds = await E.deriveSeeds(key, code + '#' + seed + ':' + g, rounds);
    let s = E.createRun({ code, seeds }, cfg);
    const play = makeBot(bot);
    let n = 0, maxRep = s.rep;
    while (s.screen !== 'result') {
      s = E.step(s, play(E.toView(s, cfg), rand), cfg);
      onStep?.(s);
      maxRep = Math.max(maxRep, s.rep);
      if (++n > 400) throw new Error('partida sin fin: ' + code);
    }
    out.push({ capital: s.capital, titleKey: s.titleKey!, quiebra: s.quiebra, actions: n, maxRep, finalRep: s.rep });
  }
  return out;
}

export function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export interface Summary {
  bot: BotName;
  games: number;
  pMillon: number; // % con ≥ $100M (el "millón" del balance, ×100)
  pImperio: number; // % con ≥ $500M
  mediana: number;
  pQuiebra: number;
  finales: Partial<Record<TitleKey, number>>;
}

export function summarize(bot: BotName, rs: GameResult[]): Summary {
  const pct = (f: (r: GameResult) => boolean) => (100 * rs.filter(f).length) / rs.length;
  // sin prototipo: 'constructor' es un final y chocaría con Object.prototype.constructor
  const finales: Partial<Record<TitleKey, number>> = Object.create(null);
  for (const r of rs) finales[r.titleKey] = (finales[r.titleKey] || 0) + 1;
  return {
    bot, games: rs.length,
    pMillon: pct((r) => r.capital >= 100000000),
    pImperio: pct((r) => r.capital >= 500000000),
    mediana: median(rs.map((r) => r.capital)),
    pQuiebra: pct((r) => r.quiebra),
    finales,
  };
}
