// Utilidades de test: PRNG para las decisiones de los bots (independiente del RNG del juego).

/** mulberry32: rápido y determinista, solo para elegir acciones en los tests. */
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

const CHAR = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codeFrom(rand: () => number): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += CHAR[Math.floor(rand() * CHAR.length)];
  return 'MGN-' + s;
}

export const TEST_SECRET = 'test-secret-no-usar-en-produccion-0123456789abcdef';
