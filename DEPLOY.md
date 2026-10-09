# Cómo se sube El Magnate a Supabase

Primero a un proyecto de **prueba** ("el-magnate-dev"). Recién cuando todo ande ahí, y con
tu OK, al proyecto real (`ayyfmyixljjtxkfvyhsz`).

## 1. Lo que hacés vos en supabase.com (una sola vez)

1. **Crear el proyecto de prueba.** En supabase.com → *New project*. Nombre:
   `el-magnate-dev`. Región: **South America (São Paulo)**. La contraseña de la base
   guardala en tu gestor de contraseñas; no me la pases.
2. **Usuarios anónimos.** En ese proyecto: *Authentication → Sign In / Providers* →
   activar **Allow anonymous sign-ins**. (El CAPTCHA con Turnstile en el de prueba es
   opcional; en el real, sí.)
3. **Apagar la Data API.** *Project Settings → Data API* → desactivarla. El juego no la
   usa: todo pasa por la función `api`.
4. **Un token para que yo pueda trabajar.** *Account (tu avatar) → Access Tokens* →
   *Generate new token*, con el nombre `claude-el-magnate`. **No lo pegues en el chat.**
   Cargalo en la configuración del entorno de esta sesión de Claude (menú del entorno en
   la barra de título → *Edit*) como variable de entorno:
   `SUPABASE_ACCESS_TOKEN=<el token>`.
5. **Dejarme salir a Supabase.** En esa misma pantalla, en *Network access*, agregar
   estos dominios permitidos: `api.supabase.com`, `*.supabase.co`, `*.supabase.com`.

El token se puede borrar desde supabase.com cuando terminemos.

## 2. Lo que hago yo (con el token y la red habilitados)

```sh
npx supabase link --project-ref <ref de el-magnate-dev>
npx supabase db push                       # aplica supabase/migrations
# SERVER_SECRET: 32 bytes al azar, generados y cargados sin mostrarse nunca
npx supabase secrets set SERVER_SECRET="$(openssl rand -base64 48)" >/dev/null
npx supabase secrets set ALLOWED_ORIGINS="http://localhost:5173,<dominio del juego>"
npm run sync:engine
npx supabase functions deploy api
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> npm run check:anon
```

`check:anon` intenta leer y escribir cada tabla con la clave pública (y con un usuario
anónimo logueado): tiene que fallar todo. Después juego una partida completa contra la
API desplegada.

Notas:

- `SERVER_SECRET` nunca se escribe en archivos ni en pantalla. **Si se rota, las
  partidas en curso quedan inválidas** (las semillas ya calculadas siguen guardadas,
  pero un duelo nuevo con el mismo código daría otra partida).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL` las inyecta Supabase
  en la función; no hay que cargarlas.
- `GAME_CONFIG` (opcional): JSON con `rounds`, `startingCapital`, `eventChance`,
  `incomeBase`, `minigame`. Si no está, se usan los valores del motor.
- El front solo necesita la URL del proyecto y la **anon key** (son públicas).

### Estado del proyecto de prueba (28/09/2026)

`el-magnate-dev` = `esluocwhxooyuwcyfntd` (org LB Finanzas, São Paulo, plan free).
Creado por la API; la contraseña de la base no la tiene nadie (si hace falta, se
resetea en *Project Settings → Database*). Hecho:

- usuarios anónimos activados y Data API apagada (`db_schema` vacío), por la API;
- migración `20260925120000_game` aplicada y registrada en
  `supabase_migrations.schema_migrations`;
- `SERVER_SECRET` y `ALLOWED_ORIGINS=http://localhost:5173` cargados;
- función `api` desplegada;
- `check:anon`: 64 intentos bloqueados, la API sin token responde 401;
- partida completa contra la API desplegada (usuario anónimo real, CORS, 409 después
  de terminar, desbloqueo en `/me`).

**Ojo desde la sesión en la nube:** el puerto de Postgres está bloqueado (solo sale
HTTPS), así que `supabase db push` no conecta. Las migraciones se aplican por la
Management API (`POST /v1/projects/<ref>/database/query`, dentro de un `begin/commit`
e insertando la versión en `supabase_migrations.schema_migrations`), y
`functions deploy` va con `--use-api`.

## 3. Al proyecto real

Los mismos pasos del punto 2 con `--project-ref ayyfmyixljjtxkfvyhsz`.

### Estado del proyecto real (28/09/2026)

Hecho, con el OK de la persona:

- usuarios anónimos activados (estaban apagados), Turnstile activo, Data API apagada;
- migración `20260925120000_game` aplicada y registrada;
- `SERVER_SECRET` propio (distinto del de prueba) y `ALLOWED_ORIGINS=http://localhost:5173`;
- función `api` desplegada;
- `check:anon`: 32 intentos con la anon key bloqueados, la API sin token responde 401.
  La parte de "usuario anónimo logueado" no corre acá porque Turnstile pide un token de
  CAPTCHA; se verificó en el proyecto de prueba, que tiene el mismo esquema.

Desde el 05/10/2026: `ALLOWED_ORIGINS="https://elmagnate.com.ar,https://www.elmagnate.com.ar"`
(sin `localhost`: en local el front usa el proyecto de prueba) y la función `api` redesplegada
con el código de la partida oculto hasta el final.

## 4. El front (web/)

`web/` es una página estática: se sube la carpeta tal cual, sin build. Casi todo sale de
`npm run build:web`, que la arma desde `handoff/referencia/deploy-actual.html` (mismo
template, fuentes, logo y runtime, así se ve idéntica). Se escriben a mano solo
`web/app.js` (la lógica que habla con la API) y `web/config.js`.

- En `localhost` usa el proyecto de prueba (sin CAPTCHA); en cualquier otro dominio, el
  real con Turnstile.
- Para probar local: `cd web && python3 -m http.server 5173` y abrir http://localhost:5173.

### Dónde está publicada (05/10/2026)

En https://elmagnate.com.ar y https://www.elmagnate.com.ar, en la cuenta de Cloudflare de
la empresa: un Worker `el-magnate` que solo sirve los archivos de `web/` (Cloudflare ahora
crea los proyectos de Pages así). La config está en `wrangler.jsonc`; `web/.assetsignore`
deja afuera `web/test/`.

Se publica sola: cada push a `main` corre `npm test` y, si pasa, `wrangler deploy`
(`.github/workflows/deploy.yml`; el resultado se ve en la pestaña *Actions* de GitHub). Usa dos
secretos del environment `Prod` del repo (*Settings → Environments → Prod*), que solo puede
cargar el dueño del repo:

- `CLOUDFLARE_ACCOUNT_ID`: el id de la cuenta de Cloudflare de la empresa.
- `CLOUDFLARE_API_TOKEN`: un token solo para esto, creado con la plantilla *Edit Cloudflare
  Workers*, limitado a esa cuenta y a la zona `elmagnate.com.ar`. *Workers Scripts: Edit* no
  se puede limitar a un Worker: el token puede cambiar todos los Workers de la cuenta.

A mano da lo mismo: `npx wrangler deploy` desde la raíz, con esas dos variables de entorno.

CAPTCHA: widget de Turnstile "El Magnate" en la misma cuenta, con los dos dominios. Su
Site Key está en `web/config.js`; la Secret Key va solo en Supabase (*Authentication →
Attack Protection → Captcha*). Si se agrega otro dominio, sumarlo al widget y a
`ALLOWED_ORIGINS`.

## 5. Fase 4 (desplegada en prueba y en el real, 02/10/2026)

- Migración `20261002120000_fase4`: función `game.recompute_rareza(min_muestra)` (2.000
  partidas por defecto), índice del ranking semanal y dos tareas de **pg_cron**:
  `magnate-rareza` (todos los días 06:17 UTC = 03:17 en Argentina) y
  `magnate-abandonadas` (cada hora, marca como abandonadas las partidas sin acciones por 24 h).
- API: `GET /api/rareza` → `{ fuente: 'simulacion' | 'real', partidas, pct: {final: %} }`.
  La tabla semanal (`period=semana`) arranca el lunes 00:00 hora argentina.
- Front: las tablas de Ranking salen de `GET /api/ranking?by=plata` (semanal e histórica);
  la colección y la carta usan la rareza real cuando el job ya la calculó.
- Partidas de menos de 40 s quedan marcadas y fuera del ranking (anti-bots).
- Ver las tareas: `select * from cron.job;` · últimas corridas: `select * from cron.job_run_details order by start_time desc limit 10;`

### Resultados del duelo (02/10/2026, desplegado en prueba y en el real)

Diseño de Design en `handoff/referencia/El Magnate.dc.html` (§6 bis del README del handoff).
`npm run build:web` ahora toma el template de ese `.dc.html` (codificado igual que el
bundler; con el `.dc.html` anterior da exactamente la versión publicada).

- `POST /api/runs { duelo }` con un código que el jugador ya jugó (o creó): no crea partida,
  responde `{ alreadyPlayed: true, runId, version, status, view, duelo }`. Si su intento
  estaba abandonado, lo reactiva para que lo termine (sigue siendo su primer intento).
- `GET /api/duelos/:code` → `{ code, rows: [{ pos, tag, mine, status, icon, title, amount }] }`,
  terminadas por capital → jugando → abandonadas. 403 si no lo jugó; 1 consulta cada 3 s.

## 6. Google Analytics 4 (front)

- `web/analytics.js` carga GA4 **solo** si hay Measurement ID y la persona tocó "Dale" en el
  aviso de cookies (Consent Mode v2, `analytics_storage` denegado por defecto). Si rechaza o
  no elige, no se carga nada de Google. La elección queda en `localStorage`
  (`elmagnate.cookies`).
- El Measurement ID está en `web/config.js`, solo en la config del dominio real: en
  `localhost` no se carga Analytics y no se ensucian los datos. No es secreto (se ve en el
  navegador igual).
- Eventos: `game_start`, `game_finish`, `sillon_play`, `duelo_share`, `story_download`,
  `lbtag_saved`, `cta_click`. Solo pasan los parámetros `es_duelo`, `final_key`, `quiebra`,
  `capital_rango` y `origen`: nunca $LBtag, ids, código de duelo ni montos exactos.
- El link de "Desafiá a alguien" lleva `utm_source=duelo&utm_medium=share`; la URL que
  llega a GA reemplaza el código de duelo por `duelo=1`.
