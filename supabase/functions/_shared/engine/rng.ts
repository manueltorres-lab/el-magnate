// COPIA de /engine generada por scripts/sync-engine.mjs. No editar acá.
// Azar del juego: xorshift32 idéntico al original (`rnd()`), con el estado explícito
// en vez de una global. Las semillas salen de HMAC-SHA256 con un secreto del servidor.

/** FNV-1a de 32 bits. Es el hash del front original; se usa solo para la semilla legada. */
export function hashStr(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Semilla del front original: hashStr(code|n). Pública, así que solo sirve para tests de paridad. */
export function legacySeed(code: string, n: number): number {
  return (hashStr(String(code) + '|' + n) || 1) >>> 0;
}

/** Generador con estado mutable. Se crea desde `state.rngState` y se guarda al final de cada acción. */
export class Rng {
  s: number;
  constructor(state: number) {
    this.s = state >>> 0;
  }
  /** Mismo algoritmo, mismo orden de operaciones que `rnd()` en el original. */
  next(): number {
    let s = this.s;
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    this.s = s;
    return s / 4294967296;
  }
  /** rand(a, b) del original */
  range(a: number, b: number): number {
    return this.next() * (b - a) + a;
  }
  /** Fisher-Yates del original (consume rnd() de i = n-1 a 1) */
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

const enc = new TextEncoder();

/** u32 big-endian de los primeros 4 bytes de HMAC_SHA256(secret, code|n); nunca 0 (xorshift se traba en 0). */
export async function hmacSeed(key: CryptoKey, code: string, n: number): Promise<number> {
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(String(code) + '|' + n)));
  const u = ((sig[0] << 24) | (sig[1] << 16) | (sig[2] << 8) | sig[3]) >>> 0;
  return u || 1;
}

export function importSecret(secret: string): Promise<CryptoKey> {
  if (!secret || secret.length < 32) throw new Error('SERVER_SECRET tiene que tener al menos 32 caracteres');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

/**
 * Semillas de toda la partida: n = 0 (arranque) y n = 1..rounds (un re-sembrado por pick).
 * Se calculan al crear la partida (HMAC es async en WebCrypto) y se guardan con el estado,
 * así `step` sigue siendo sincrónico y puro.
 */
export async function deriveSeeds(secret: string | CryptoKey, code: string, rounds: number): Promise<number[]> {
  const key = typeof secret === 'string' ? await importSecret(secret) : secret;
  const out: number[] = [];
  for (let n = 0; n <= rounds; n++) out.push(await hmacSeed(key, code, n));
  return out;
}

export function legacySeeds(code: string, rounds: number): number[] {
  const out: number[] = [];
  for (let n = 0; n <= rounds; n++) out.push(legacySeed(code, n));
  return out;
}

const CHAR = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Código de partida MGN-XXXXX con azar criptográfico (el original usaba Math.random). */
export function mkCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  let s = '';
  for (let i = 0; i < 5; i++) s += CHAR[bytes[i] % CHAR.length]; // 256 % 32 = 0: sin sesgo
  return 'MGN-' + s;
}

/** Misma validación que cleanCode() del front. */
export function cleanCode(v: unknown): string | null {
  const c = String(v || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);
  return /^MGN-[A-Z0-9]{5}$/.test(c) ? c : null;
}
