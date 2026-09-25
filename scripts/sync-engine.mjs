// Copia /engine a supabase/functions/_shared/engine para que el deploy de la Edge Function
// lo incluya (el bundler de Supabase solo sube supabase/functions). Sin los tests.
// Uso: node scripts/sync-engine.mjs        (--check: falla si la copia está desactualizada)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = root + 'engine/';
const dst = root + 'supabase/functions/_shared/engine/';
const HEADER = '// COPIA de /engine generada por scripts/sync-engine.mjs. No editar acá.\n';
const files = readdirSync(src).filter((f) => f.endsWith('.ts'));

if (process.argv.includes('--check')) {
  const stale = files.filter((f) => !existsSync(dst + f) || readFileSync(dst + f, 'utf8') !== HEADER + readFileSync(src + f, 'utf8'));
  const extra = existsSync(dst) ? readdirSync(dst).filter((f) => !files.includes(f)) : [];
  if (stale.length || extra.length) {
    console.error('La copia del motor está desactualizada:', [...stale, ...extra].join(', '), '→ correr npm run sync:engine');
    process.exit(1);
  }
  console.log('copia del motor al día');
} else {
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  for (const f of files) writeFileSync(dst + f, HEADER + readFileSync(src + f, 'utf8'));
  console.log('motor copiado a', dst.replace(root, ''), `(${files.length} archivos)`);
}
