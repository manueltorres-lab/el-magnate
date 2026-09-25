// GAME_CONFIG: JSON opcional con los props tweakeables. Solo se aceptan claves y tipos conocidos.
import { resolveConfig, type Config } from './engine/index.ts';

const NUM_KEYS = ['rounds', 'startingCapital', 'eventChance', 'incomeBase'] as const;

export function parseGameConfig(raw: string | undefined | null): Config {
  if (!raw) return resolveConfig({});
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error('GAME_CONFIG no es JSON válido');
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('GAME_CONFIG tiene que ser un objeto');
  const o = obj as Record<string, unknown>;
  const out: Partial<Config> = {};
  for (const k of Object.keys(o)) {
    if (!(NUM_KEYS as readonly string[]).includes(k) && k !== 'minigame') throw new Error('GAME_CONFIG: clave desconocida ' + k);
  }
  for (const k of NUM_KEYS) {
    if (o[k] === undefined) continue;
    if (typeof o[k] !== 'number' || !Number.isFinite(o[k])) throw new Error('GAME_CONFIG.' + k + ' tiene que ser un número');
    out[k] = o[k] as number;
  }
  if (o.minigame !== undefined) {
    if (typeof o.minigame !== 'boolean') throw new Error('GAME_CONFIG.minigame tiene que ser true o false');
    out.minigame = o.minigame;
  }
  if (out.eventChance !== undefined && (out.eventChance < 0 || out.eventChance > 1)) throw new Error('GAME_CONFIG.eventChance va de 0 a 1');
  if (out.rounds !== undefined && !Number.isInteger(out.rounds)) throw new Error('GAME_CONFIG.rounds tiene que ser entero');
  return resolveConfig(out);
}
