// Arma el front estático en /web a partir de la versión publicada del juego
// (handoff/referencia/deploy-actual.html): mismo template, mismo runtime, mismas fuentes y
// el mismo logo, así la UI queda idéntica. Lo único que cambia es el <script data-dc-script>:
// en vez de la lógica del juego, una clase que le pregunta todo al servidor (web/app.js).
// También genera web/data.js con los textos que el front sigue necesitando (TITLES, RAREZA…),
// sacados del motor para que no se desincronicen.
//
// Uso: node scripts/build-web.mjs          (--check: falla si /web está desactualizado)
// Los archivos escritos a mano son web/app.js y web/config.js; el resto sale de acá.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { CALMA_ALTA, CALMA_BAJA, ORDEN_COL, RAREZA, RULETA, SLOT_SYMBOLS, TAG_LABEL, TITLES } from '../engine/data.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const WEB = root + 'web/';
const bundle = readFileSync(root + 'handoff/referencia/deploy-actual.html', 'utf8');

const block = (type) => {
  const m = bundle.match(new RegExp(`<script type="__bundler/${type}">([\\s\\S]*?)</script>`));
  if (!m) throw new Error('No encontré __bundler/' + type + ' en deploy-actual.html');
  return JSON.parse(m[1]);
};
const manifest = block('manifest');
const ext = block('ext_resources');
let page = block('template');

const asset = (uuid) => {
  const a = manifest[uuid];
  if (!a) throw new Error('Falta el recurso ' + uuid);
  const buf = Buffer.from(a.data, 'base64');
  return a.compressed ? gunzipSync(buf) : buf;
};
const extUuid = (url) => {
  const r = ext.find((e) => e.id === url);
  if (!r) throw new Error('Falta ' + url + ' en ext_resources');
  return r.uuid;
};

/** ruta publicada → contenido */
const out = new Map();

// runtime del template y React (el runtime los pide a unpkg; app.js le indica estas copias)
const runtimeUuid = page.match(/<script src="([0-9a-f-]{36})"><\/script>/)[1];
out.set('vendor/dc-runtime.js', asset(runtimeUuid));
out.set('vendor/react.production.min.js', asset(extUuid('https://unpkg.com/react@18.3.1/umd/react.production.min.js')));
out.set('vendor/react-dom.production.min.js', asset(extUuid('https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js')));
out.set('vendor/supabase.js', readFileSync(root + 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'));

// fuentes y logo: los mismos archivos que la versión publicada
const fonts = new Map();
page = page.replace(/url\("([0-9a-f-]{36})"\)/g, (_, uuid) => {
  if (!fonts.has(uuid)) {
    fonts.set(uuid, `fonts/jakarta-${fonts.size + 1}.woff2`);
    out.set(fonts.get(uuid), asset(uuid));
  }
  return `url("${fonts.get(uuid)}")`;
});
const imgUuids = new Set([...page.matchAll(/<img src="([0-9a-f-]{36})"/g)].map((m) => m[1]));
if (imgUuids.size !== 1) throw new Error('Esperaba un solo logo en el template');
const [logoUuid] = imgUuids;
out.set('assets/lb-logo-blanco.svg', asset(logoUuid));
page = page.split(`src="${logoUuid}"`).join('src="assets/lb-logo-blanco.svg"');

// El template sale del .dc.html (ahí Design suma pantallas nuevas, como la del duelo), con la
// misma codificación que aplica el bundler al publicar: los atributos en camelCase pasan a
// sc-camel-*. Con el .dc.html de la versión publicada esto da exactamente su template.
const dc = readFileSync(root + 'handoff/referencia/El Magnate.dc.html', 'utf8');
const bodyOf = (h) => [h.indexOf('</helmet>') + '</helmet>'.length, h.indexOf('</x-dc>')];
const encode = (s) => s.replace(/\s(on[A-Z]\w*|viewBox|preserveAspectRatio)=/g,
  (_, a) => ' sc-camel-' + a.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()) + '=');
{
  const [a, b] = bodyOf(dc), [pa, pb] = bodyOf(page);
  if (a < 9 || b < 0 || pa < 9 || pb < 0) throw new Error('No encontré el template en el .dc.html o en la versión publicada');
  page = page.slice(0, pa) + encode(dc.slice(a, b)) + page.slice(pb);
}

// scripts: config y sesión, datos, lógica conectada y recién después el runtime (que arranca solo)
page = page.replace(
  `<script src="${runtimeUuid}"></script>`,
  ['config.js', 'analytics.js', 'vendor/supabase.js', 'data.js', 'app.js', 'vendor/dc-runtime.js']
    .map((s) => `<script src="${s}"></script>`).join('\n'),
);

// la lógica del juego se va: queda una clase que delega en web/app.js
page = page.replace(
  /<script type="text\/x-dc" data-dc-script="[^"]*"[^>]*>[\s\S]*?<\/script>/,
  '<script type="text/x-dc" data-dc-script="">\nclass Component extends window.MagnateLogic(DCLogic) {}\n</script>',
);

// dos agregados al template: el botón de empezar muestra que está preparando la partida,
// y un aviso abajo para errores de red con "Reintentar" (§8.5 y §8.6 del handoff)
const startBtn = '>Empezar la partida</button>';
if (!page.includes(startBtn)) throw new Error('No encontré el botón de empezar');
page = page.replace(startBtn, '>{{ startLabel }}</button>');

// "Descargar imagen" de la carta usaba la misma acción que "Copiar el texto": con una propia
// se puede medir aparte (Google Analytics, evento story_download)
{
  const re = /sc-camel-on-click="\{\{ onCopy \}\}"([^>]*>Descargar imagen<\/button>)/;
  if (!re.test(page)) throw new Error('No encontré el botón "Descargar imagen"');
  page = page.replace(re, 'sc-camel-on-click="{{ onStoryDownload }}"$1');
}

// Fase 4: el ranking y la rareza son reales; las notas al pie dejan de decir "de ejemplo"
for (const [from, to] of [
  ['Tablas ilustrativas. Los $LBtag que ves son de ejemplo.', '{{ rankNote }}'],
  ['Los porcentajes salen de simular 7.000 partidas.', '{{ colNote }}'],
]) {
  if (!page.includes(from)) throw new Error('No encontré: ' + from);
  page = page.replace(from, to);
}

const NET = `
<sc-if value="{{ net.show }}">
  <div role="alert" style="position:fixed;left:16px;right:16px;bottom:16px;z-index:60;max-width:560px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,138,155,.55);background:#2a1420;color:#fbfafd;font-family:'Plus Jakarta Sans',sans-serif;font-size:14.5px;line-height:1.4;box-shadow:0 12px 32px rgba(0,0,0,.45);animation:mgIn .25s ease;">
    <span style="flex:1;">{{ net.msg }}</span>
    <sc-if value="{{ net.hasRetry }}">
      <button sc-camel-on-click="{{ net.retry }}" style="flex:none;padding:10px 14px;border-radius:10px;border:none;background:#73ffa1;color:#0d3320;font-size:14px;font-weight:700;cursor:pointer;" style-hover="background:#8dffb4">Reintentar</button>
    </sc-if>
  </div>
</sc-if>
`;
const endTpl = page.indexOf('</x-dc>');
const lastDiv = page.lastIndexOf('</div>', endTpl);
if (endTpl < 0 || lastDiv < 0) throw new Error('No encontré el cierre del template');
page = page.slice(0, lastDiv) + NET + page.slice(lastDiv);

out.set('index.html', '<!-- GENERADO por scripts/build-web.mjs desde handoff/referencia/deploy-actual.html. No editar a mano. -->\n' + page);

// textos que el front muestra sin necesitar al servidor (colección, etiquetas, ruleta)
const data = { TAG_LABEL, TITLES, RAREZA, ORDEN_COL, SLOT_SYMBOLS, RULETA, CALMA_BAJA, CALMA_ALTA };
out.set('data.js', '// GENERADO por scripts/build-web.mjs desde engine/data.ts. No editar a mano.\n'
  + 'window.MAGNATE_DATA = ' + JSON.stringify(data, null, 1) + ';\n');

if (process.argv.includes('--check')) {
  const stale = [...out].filter(([p, c]) => !existsSync(WEB + p) || !readFileSync(WEB + p).equals(Buffer.from(c)));
  if (stale.length) {
    console.error('/web está desactualizado:', stale.map(([p]) => p).join(', '), '→ correr npm run build:web');
    process.exit(1);
  }
  console.log('/web al día');
} else {
  for (const [p, c] of out) {
    mkdirSync(dirname(WEB + p), { recursive: true });
    writeFileSync(WEB + p, c);
  }
  console.log(`web/ armado (${out.size} archivos)`);
}
