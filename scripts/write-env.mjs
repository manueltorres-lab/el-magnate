// Escribe web/env.js con la config del front que depende del entorno (por ahora, el
// Measurement ID de Google Analytics). Correrlo antes de publicar:
//   GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run build:env && npx wrangler deploy
// También lee .env si existe. Sin GA_MEASUREMENT_ID, el archivo queda vacío y no se carga GA.
// En el repo, web/env.js va siempre vacío: el ID se carga en el hosting, solo en producción.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raw = (process.env.GA_MEASUREMENT_ID || '').trim();
if (raw && !/^G-[A-Z0-9]{4,}$/.test(raw)) {
  console.error('GA_MEASUREMENT_ID no tiene la forma G-XXXXXXXXXX:', JSON.stringify(raw));
  process.exit(1);
}
const env = { gaMeasurementId: raw };
const file = fileURLToPath(new URL('../web/env.js', import.meta.url));
writeFileSync(file, '// GENERADO por scripts/write-env.mjs (npm run build:env). En el repo va vacío.\n'
  + 'window.MAGNATE_ENV = ' + JSON.stringify(env) + ';\n');
console.log(raw ? 'web/env.js con Google Analytics ' + raw : 'web/env.js sin Google Analytics');
