// Balance: 4.000 partidas por bot, con semillas DISTINTAS a las de la línea base, tienen que
// caer dentro de la tolerancia del handoff (±10% relativo en medianas, ±1 punto en %).
// Para los porcentajes altos (p. ej. ~30% de quiebra del manotazo) ±1 punto es menos que el
// ruido de muestreo de 4.000 partidas (error estándar ≈ 0,7 puntos), así que la tolerancia
// es max(1 punto, 3 errores estándar). La línea base sale de 20.000 partidas por bot
// (node sim/run.ts 20000 --write). Ver sim/README.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOTS } from './bots.ts';
import { simulate, summarize, type Summary } from './simulate.ts';

const GAMES = Number(process.env.BALANCE_GAMES || 4000);
const baseline: { rows: Omit<Summary, 'finales'>[] } = JSON.parse(readFileSync(new URL('./baseline.json', import.meta.url), 'utf8'));

for (const [i, bot] of BOTS.entries()) {
  test(`balance: ${bot}`, async () => {
    const s = summarize(bot, await simulate(bot, GAMES, 50000 + i));
    const b = baseline.rows.find((r) => r.bot === bot)!;
    const rel = Math.abs(s.mediana - b.mediana) / b.mediana;
    assert.ok(rel <= 0.10, `mediana ${s.mediana.toFixed(0)} vs ${b.mediana.toFixed(0)} (${(rel * 100).toFixed(1)}%)`);
    for (const k of ['pMillon', 'pImperio', 'pQuiebra'] as const) {
      const p = b[k] / 100;
      const se = 100 * Math.sqrt((p * (1 - p)) / GAMES);
      const tol = Math.max(1, 3 * se);
      assert.ok(Math.abs(s[k] - b[k]) <= tol, `${k}: ${s[k].toFixed(2)} vs ${b[k].toFixed(2)} (tolerancia ${tol.toFixed(2)})`);
    }
  });
}

test('los 19 finales son alcanzables', async () => {
  const seen = new Set<string>();
  for (const [i, bot] of BOTS.entries()) {
    for (const r of await simulate(bot, 2500, 90000 + i)) seen.add(r.titleKey);
  }
  const { ORDEN_COL } = await import('../engine/data.ts');
  const faltan = ORDEN_COL.filter((k) => !seen.has(k));
  assert.deepEqual(faltan, [], 'finales sin alcanzar: ' + faltan.join(', '));
  assert.equal(ORDEN_COL.length, 19);
});
