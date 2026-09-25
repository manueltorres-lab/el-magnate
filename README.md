# El Magnate: servidor autoritativo

Migración del juego "El Magnate" a un servidor que decide todo: el front solo muestra y
manda intenciones ("elegí la opción 2", "me planto"). El plan completo está en
[`handoff/README.md`](handoff/README.md); la fuente de verdad de la lógica es
[`handoff/referencia/El Magnate.dc.html`](handoff/referencia/El%20Magnate.dc.html).

## Estado

| Fase | Qué | Estado |
|---|---|---|
| 1 | Motor puro + tests + simulación de balance | ✅ Hecha: ver abajo |
| 2 | Supabase + API | 🚧 En curso: ver "Dónde quedó la Fase 2" |
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

## Dónde quedó la Fase 2 (para retomar)

Hecho (sin commitear a Supabase todavía, nada desplegado):

- `supabase/migrations/20260925120000_game.sql`: tablas del §7 en el schema `game`
  (no expuesto), RLS sin policies, revokes, `rate_hit`, `abandon_stale_runs`, vista
  `ranking_candidates`, siembra de `rareza`. **Aplica sin errores** en Postgres 16.
- `supabase/functions/_shared/`: `app.ts` (Hono, todas las rutas del §6), `store.ts`
  (SQL directo con `postgres`, control optimista en una transacción), `auth.ts`
  (valida el JWT con Supabase Auth), `config.ts` (GAME_CONFIG), `errors.ts`.
- `supabase/functions/api/index.ts` + `deno.json`: `deno check` pasa.
- `scripts/sync-engine.mjs`: copia `/engine` a `_shared/engine` (el deploy solo sube
  `supabase/functions`); con `--check` falla si la copia quedó vieja.
- `scripts/pg-local.sh`: Postgres local descartable con un shim de Supabase
  (`supabase/tests/supabase-shim.sql`) para probar sin Docker.
- Tests escritos: `supabase/tests/api.test.ts` (partida completa por HTTP, doble envío,
  dos pestañas, fuera de fase, partida ajena, duelo, $LBtag, ranking, rate limit, CORS,
  reproducir una partida desde `run_actions`) y `supabase/tests/security.test.ts`.

Próximo paso inmediato: **los tests de la API todavía no pasan.** El primer error:
`POST /api/runs` devuelve 500 porque `toView` recibe un `state` que no es el objeto
(`Object.entries(undefined)` en `view.ts`). Casi seguro es cómo vuelve el `jsonb`
insertado con `tx.unsafe(..., JSON.stringify(state))::jsonb` en `store.ts`
(`createRun`/`getRun`): revisar que `state`/`config` lleguen como objeto (usar
`sql.json(...)` o parsear si vienen como string). Para ver el stack: `API_DEBUG=1`.

Después:

1. Hacer pasar `node --test --test-concurrency=1 supabase/tests/*.test.ts` y sumarlo a
   `npm test` (con `npm run sync:engine -- --check`).
2. Smoke test del entrypoint en Deno contra la base local con un Auth falso.
3. Script de chequeo con la anon key contra el proyecto real (select/insert en cada
   tabla tiene que fallar).
4. Con la persona: crear "el-magnate-dev", `npx supabase login` + `link`, cargar
   `SERVER_SECRET` con `supabase secrets set` sin mostrarlo, `ALLOWED_ORIGINS`,
   desactivar la Data API para `public`, y recién ahí migraciones + deploy al dev.
   Preguntar antes de tocar el proyecto real `ayyfmyixljjtxkfvyhsz`.
