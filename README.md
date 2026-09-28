# El Magnate: servidor autoritativo

Migración del juego "El Magnate" a un servidor que decide todo: el front solo muestra y
manda intenciones ("elegí la opción 2", "me planto"). El plan completo está en
[`handoff/README.md`](handoff/README.md); la fuente de verdad de la lógica es
[`handoff/referencia/El Magnate.dc.html`](handoff/referencia/El%20Magnate.dc.html).

## Estado

| Fase | Qué | Estado |
|---|---|---|
| 1 | Motor puro + tests + simulación de balance | ✅ Hecha: ver abajo |
| 2 | Supabase + API | ✅ Desplegada y verificada en el proyecto de prueba. Falta el real (con tu OK): ver [`DEPLOY.md`](DEPLOY.md) |
| 3 | Front conectado | Pendiente |
| 4 | Ranking, colección, duelos reales | Pendiente |
| 5 | Imagen de la story en el server (opcional) | Pendiente |

## Estructura

```
engine/            motor puro, sin dependencias (corre en Node ≥ 22.18 y en Deno)
  types.ts         RunState, Action, Config…
  data.ts          GENERADO desde el .dc.html (scripts/extract-data.mjs). No editar a mano.
  rng.ts           xorshift32 del original, semillas HMAC-SHA256(SERVER_SECRET, code|n)
  rules.ts         incomeFor, yieldRate, bigThreshold, computeTitleKey, handVal…
  step.ts          createRun() y el reducer step(state, action, cfg)
  view.ts          toView(state): lo único que ve el jugador
  actions.ts       validActions(view): qué acciones acepta el server en cada momento
  test/            paridad, golden, invariantes, fugas de la vista
sim/               bots de estrategia y test de balance
scripts/           extracción de datos y carga del juego original para los tests
handoff/           el paquete de handoff tal como llegó (referencia, capturas, logos)
```

## Cómo se usa el motor

```ts
import { createRun, deriveSeeds, mkCode, step, toView } from './engine/index.ts';

const code = mkCode();                                  // o el código del duelo
const seeds = await deriveSeeds(SERVER_SECRET, code, 12); // una por pick + la inicial
let state = createRun({ code, seeds });                 // se guarda entero en runs.state
state = step(state, { type: 'pick', option: 2 });       // tira EngineError si no corresponde
const view = toView(state);                             // esto, y solo esto, va al cliente
```

- `step` es puro y sincrónico: mismo estado + misma acción = mismo resultado. Las semillas
  se calculan una vez al crear la partida (HMAC es async en WebCrypto) y viajan en el estado.
- El estado es JSON puro: se puede guardar en `jsonb` y volver a cargar sin perder nada
  (los tests de paridad hacen ese viaje en cada acción).
- Errores: `EngineError` con `code = 'out_of_phase'` (→ 409) o `'bad_action'` (→ 400).

## Tests

```
npm install
npm run typecheck      # tsc estricto
npm test               # motor: paridad, golden, invariantes, vista  (~1 min)
npm run test:balance   # 4.000 partidas por bot contra la línea base (~3 min)
npm run sim            # imprime la tabla de balance
```

Qué cubren:

- **Paridad** (`engine/test/parity.test.ts`): corre el `<script data-dc-script>` original en
  Node con la semilla vieja (`hashStr`) y juega ~1.700 partidas en paralelo con el motor,
  eligiendo acciones al azar por los mismos caminos que la UI. Después de **cada** acción
  compara capital, stats, historial, toast, minijuego, orden de escenarios, bolsa de
  minijuegos y el estado del RNG: tienen que ser idénticos al último decimal. Incluye
  configs alternativas (6 y 20 rondas, eventos siempre/nunca, sin minijuegos). También
  verifica que los datos de `engine/data.ts` sean idénticos a los del original.
- **Golden** (`engine/test/golden.test.ts`): con un secreto fijo y acciones fijas, las
  semillas HMAC y el estado final no cambian (`golden.snap.json`).
- **Invariantes** (`engine/test/invariants.test.ts`): sin `NaN`, capital ≥ 0, rep/cabeza
  enteras en 0–100, toda partida termina; en cada paso, todas las acciones fuera de fase
  o con payload inválido se rechazan sin tocar el estado; el duelo es reproducible.
- **Vista** (`engine/test/view.test.ts`): recorre todas las fases y minijuegos y verifica
  que no salgan `order`, `showRound`, `rngState`, semillas, `miniBag`, `min`/`max`,
  `tagCounts`/`riskCounts`, los sobres antes de abrir, el sector o los rodillos antes del
  giro, la carta tapada de la banca, ni la respuesta o el porqué del Sillón antes de responder.
- **Balance** (`sim/balance.test.ts`): ver [`sim/README.md`](sim/README.md).

## Decisiones tomadas en la Fase 1

- **Apuestas de minijuego: 5%, 12% y 25%.** El handoff decía `0.1 | 0.25 | 0.5` pero pedía
  verificarlo en el template: los botones son *Poco* 0.05, *Medio* 0.12 y *Fuerte* 0.25.
  Solo se aceptan esos tres valores.
- **Blackjack**: como en la UI, la banca muestra la primera carta y el resto tapado
  (`{hidden:true}`) hasta que te plantás o te pasás; el valor visible es el de la primera carta.
- **Opciones del escenario**: no salen `min`/`max`. Sí salen dos datos derivados que la UI
  muestra: el monto comprometido (`stake`) y la marca `puedeFundir`.
- **El Sillón**: `quizNext` y `quizClose` solo se aceptan cuando la UI los ofrece (después de
  responder). En el original `cerrarQuiz` se podía llamar desde la consola antes de responder.
- **Giros al instante**: `slotsSpin` y `ruletaSpin` devuelven el resultado final; el front
  anima hasta ahí (el ángulo de la ruleta lo calcula el front a partir de `sector`).
- **Minijuego con la cabeza de antes**: `makeMini` decide si estás "apurado" con la cabeza
  previa al pick, como el original (lee `this.state` antes del `setState`). Se mantiene.
- **Código de partida**: `mkCode()` usa `crypto.getRandomValues` (el original usaba
  `Math.random`). La semilla ya no se deriva del código solo: `u32(HMAC(SERVER_SECRET, code|n))`.

## Fase 2: API

```
supabase/
  config.toml                       [functions.api] verify_jwt = true
  migrations/20260925120000_game.sql schema `game`: tablas, RLS sin policies, revokes,
                                    rate_hit, abandon_stale_runs, ranking_candidates
  functions/api/index.ts            entrypoint (Deno.serve) + deno.json
  functions/_shared/app.ts          Hono: todas las rutas del §6
  functions/_shared/store.ts        SQL directo a Postgres (SUPABASE_DB_URL), control optimista
  functions/_shared/auth.ts         valida el JWT con Supabase Auth → player_id
  functions/_shared/engine/         COPIA de /engine (npm run sync:engine)
  tests/                            integración, seguridad y prueba de humo en Deno
```

Rutas (todas bajo `/functions/v1/api`, todas con `Authorization: Bearer <access_token>`):

| Ruta | Qué hace |
|---|---|
| `POST /api/runs` `{duelo?}` | Crea partida. Sin duelo el código lo genera el server. Abandona la activa anterior. |
| `GET /api/runs/:id` | Retoma (recarga de página). 404 si no es tuya. |
| `POST /api/runs/:id/actions` `{version, action}` | Aplica una acción. 409 si la versión no coincide o la acción no corresponde. |
| `GET /api/me` | `{playerId, lbtag, unlocked}` |
| `PUT /api/me/lbtag` `{lbtag}` | Valida formato (3–20, `a-z0-9._`) y unicidad. |
| `GET /api/ranking?by=rareza\|plata&period=semana\|historico` | Mejor partida por jugador; solo terminadas, sin duelo, sin flag, con $LBtag. |
| `GET /api/duelos/:code` | Primer intento de cada jugador con ese código. |

Respuestas: `{runId?, version, status, view}`; errores `{error:{code, message}}` con
mensajes en castellano. Anti-abuso: 30 partidas/hora por jugador y 120 por IP, 5
acciones/segundo; partidas terminadas en menos de 40 s o con más de 200 acciones quedan
marcadas (`flagged`) y fuera del ranking.

Tests (`npm run test:api`, levanta un Postgres local descartable con `scripts/pg-local.sh`):

- **Integración**: partida completa por HTTP, recarga, doble envío, dos pestañas a la
  vez (gana exactamente una), fuera de fase, payloads inválidos, campos extra que no
  llegan a la base, partida ajena, una sola activa, duelo (mismos escenarios y mismo
  resultado; cuenta solo el primer intento), $LBtag, ranking, rate limit, CORS, errores
  internos sin detalles, y **reproducir una partida desde `run_actions`**. Ninguna
  respuesta incluye campos prohibidos.
- **Seguridad**: con los roles `anon` y `authenticated` falla todo select/insert/delete
  y toda función; RLS activo y sin policies; cero privilegios sobre el schema.
- **Deno**: corre el entrypoint real en Deno con un Auth falso: auth por supabase-js,
  conexión con `postgres`, `GAME_CONFIG`, CORS, y que los secretos no salgan en los logs.
- Contra el proyecto real: `npm run check:anon` (ver `DEPLOY.md`).

Decisiones de la Fase 2:

- **Sin Data API**: la función se conecta directo a Postgres; las tablas viven en el
  schema `game`, que no se expone. Doble candado: RLS sin policies + `revoke`.
- **El motor se copia** a `supabase/functions/_shared/engine` porque el deploy solo sube
  `supabase/functions`. `npm test` falla si la copia quedó vieja.
- **jsonb reordena las claves** de los objetos. El motor no depende de ese orden (hay un
  test), y el panel "Tus posiciones" desempata por el primer pick de cada perfil, que es
  el mismo orden que usaba el original.
- **El ranking se calcula con una consulta** (mejor partida por jugador). La vista
  materializada con `pg_cron`, el job de rareza y el abandono automático a las 24 h
  quedan para la Fase 4 (la función `abandon_stale_runs` ya está).
