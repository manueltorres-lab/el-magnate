// Tabla de balance: node sim/run.ts [partidas por bot] [--write]
// Con --write guarda sim/baseline.json, la línea base contra la que compara sim/balance.test.ts.
import { writeFileSync } from 'node:fs';
import { BOTS } from './bots.ts';
import { simulate, summarize, type Summary } from './simulate.ts';

const games = Number(process.argv.find((a) => /^\d+$/.test(a)) || 4000);
const write = process.argv.includes('--write');
const rows: Summary[] = [];
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR');
const pc = (n: number, d = 1) => n.toFixed(d).replace('.', ',') + '%';

console.log(`| Cómo juega | ≥$100M | ≥$500M | Mediana | Quiebra |  (${games} partidas por bot)`);
console.log('|---|---|---|---|---|');
const all: Record<string, number> = Object.create(null);
let total = 0;
for (const [i, bot] of BOTS.entries()) {
  const rs = await simulate(bot, games, 1000 + i);
  const s = summarize(bot, rs);
  rows.push(s);
  console.log(`| ${bot} | ${pc(s.pMillon)} | ${pc(s.pImperio, 2)} | ${fmt(s.mediana)} | ${pc(s.pQuiebra)} |`);
  for (const [k, n] of Object.entries(s.finales)) all[k] = (all[k] || 0) + n!;
  total += rs.length;
}
console.log('\nFinales (todas las estrategias juntas):');
for (const [k, n] of Object.entries(all).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(14)} ${pc((100 * n) / total, 2)}`);

if (write) {
  const baseline = { games, seedBase: 1000, rows: rows.map(({ finales: _f, ...r }) => r) };
  writeFileSync(new URL('./baseline.json', import.meta.url), JSON.stringify(baseline, null, 2) + '\n');
  console.log('\nsim/baseline.json actualizado');
}
