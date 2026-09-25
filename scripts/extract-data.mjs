// Genera engine/data.ts copiando literalmente las constantes de datos del juego original
// (handoff/referencia/El Magnate.dc.html). Así los números no se tipean a mano.
// Uso: node scripts/extract-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractScript } from './original.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const lines = extractScript().split('\n');

// nombre → tipo TS
const WANTED = {
  TAG_LABEL: 'Record<Tag, string>',
  TAG_EFFECT: 'Record<Tag, { rep: number; calma: number }>',
  COMMIT: 'Record<Risk, number>',
  BIG_THRESHOLD: 'number',
  BIG_SCENARIOS: 'readonly Scenario[]',
  DESESPERADAS: 'readonly Option[]',
  FINAS: 'readonly Option[]',
  SLOT_SYMBOLS: 'readonly string[]',
  RULETA: 'readonly { mult: number; label: string }[]',
  QUIZ: 'readonly QuizQuestion[]',
  QUIZ_PCT: 'readonly number[]',
  MINI_KINDS: 'readonly BagMiniKind[]',
  CARD_R: 'readonly string[]',
  CARD_S: 'readonly string[]',
  SCENARIOS: 'readonly Scenario[]',
  EVENTS_AUTO: 'readonly AutoEvent[]',
  EVENTS_COND: 'readonly AutoEvent[]',
  EVENTS_CHOICE: 'readonly ChoiceEvent[]',
  TITLES: 'Record<TitleKey, Title>',
  RAREZA: 'Record<TitleKey, number>',
  TAG_PESO: 'Record<Tag, number>',
  TAG_FINAL: 'Partial<Record<Tag, TitleKey>>',
  ORDEN_COL: 'readonly TitleKey[]',
};

const startRe = /^(const|let|function|class) /;
const blocks = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^const ([A-Z_]+)\s*=/);
  if (!m) continue;
  let j = i + 1;
  while (j < lines.length && !startRe.test(lines[j])) j++;
  // se descartan las líneas en blanco y comentarios sueltos que preceden a la siguiente declaración
  while (j > i + 1 && (lines[j - 1].trim() === '' || /^\/\//.test(lines[j - 1]))) j--;
  blocks.push({ name: m[1], text: lines.slice(i, j).join('\n') });
}

let out = `// ARCHIVO GENERADO por scripts/extract-data.mjs a partir de
// handoff/referencia/El Magnate.dc.html. No editar a mano: los números están calibrados.
import type {
  Tag, Risk, Scenario, Option, QuizQuestion, BagMiniKind, AutoEvent, ChoiceEvent, TitleKey, Title,
} from './types.ts';

`;
const found = new Set();
for (const b of blocks) {
  if (b.name === 'CALMA_BAJA') {
    out += 'export const CALMA_BAJA = 30, CALMA_ALTA = 70;\n\n';
    if (!/^const CALMA_BAJA = 30, CALMA_ALTA = 70;$/.test(b.text)) throw new Error('CALMA cambió');
    found.add('CALMA_BAJA');
    continue;
  }
  if (b.name === 'FIRMA_MIN') {
    if (!/^const FIRMA_MIN = 2, FIRMA_SCORE = 0\.7;$/.test(b.text)) throw new Error('FIRMA cambió');
    out += 'export const FIRMA_MIN = 2, FIRMA_SCORE = 0.7;\n\n';
    found.add('FIRMA_MIN');
    continue;
  }
  const type = WANTED[b.name];
  if (!type) continue;
  found.add(b.name);
  out += b.text.replace(/^const ([A-Z_]+)\s*=/, `export const $1: ${type} =`) + '\n\n';
}
const missing = [...Object.keys(WANTED), 'CALMA_BAJA', 'FIRMA_MIN'].filter((k) => !found.has(k));
if (missing.length) throw new Error('No encontré: ' + missing.join(', '));
writeFileSync(root + 'engine/data.ts', out.trimEnd() + '\n');
console.log('engine/data.ts generado:', found.size, 'constantes');
