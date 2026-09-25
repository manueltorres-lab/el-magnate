# Handoff: backend autoritativo para El Magnate

## Prompt para pegarle a Claude Code

> Tengo un juego web, "El Magnate" (simulador financiero de LB Finanzas, en español
> rioplatense). Hoy corre entero en el navegador: toda la lógica, el azar y el estado
> viven en el front, así que cualquiera puede abrir la consola y armarse una partida
> perfecta. Quiero pasar a un **servidor autoritativo**: el back decide todo y el front
> solo muestra y manda intenciones ("elegí la opción 2", "me planto").
>
> Leé este README entero y después `referencia/El Magnate.dc.html` (la lógica está en el
> `<script data-dc-script>`, desde `const TAG_LABEL` hasta el final de `computeTitle()`).
> Portá esa lógica **tal cual**, con los mismos números: el balance está calibrado con
> decenas de miles de partidas simuladas y cualquier cambio lo rompe.
> Arrancá por la Fase 1 y no pases a la siguiente sin que pasen los tests de esa fase.

---

## Overview

Qué hay que construir:

1. Un **motor de juego puro** (`engine/`), portado del front, sin DOM ni React.
2. Una **API** que guarda cada partida en el servidor y aplica acciones sobre ella.
3. **Persistencia** de partidas, finales desbloqueados, $LBtag, ranking y duelos.
4. **Adelgazar el front**: sacarle el motor y los datos sensibles; que renderice lo que
   devuelve la API.

## Sobre los archivos de referencia

`referencia/` tiene **referencias**, no código para copiar y pegar:

| Archivo | Qué es |
|---|---|
| `El Magnate.dc.html` | El juego actual. Fuente de verdad de la lógica y el balance. |
| `deploy-actual.html` | La versión publicada hoy (mismo juego, empaquetado). |
| `balance-y-diseno.md` | Por qué cada número es el que es, y la tabla de resultados esperados. |
| `textos-extraidos.json` | Los 233 textos del juego con su parámetro de impacto (usado para compliance). |

Además:

- `capturas/` — inicio, partida, El Sillón y pantalla final, para referencia visual.
- `assets/` — logo de LB Finanzas (logotipo completo e isotipo), sin fondo, en blanco
  (`#ffffff`, para fondo oscuro) y violeta (`#8555ff`, para fondo claro). Usar siempre
  estos archivos; no reescribir "LB FINANZAS" como texto. Proporciones: logotipo
  752×90, isotipo 201×270.
- **Regla de marca:** LB Finanzas no aparece hasta la pantalla final (ni en el inicio,
  ni durante la partida, ni en el favicon ni en el título de la pestaña), para que el
  jugador no asocie el juego con la marca antes de terminar. Solo va en la pantalla de
  fin de partida, la carta, la story y el CTA.

El front es un "Design Component" (HTML con plantilla + una clase JS). Si se reescribe el
front en otro framework (React/Next/Vue), respetar el sistema visual descripto en
`balance-y-diseno.md` §7 bis. **El diseño visual no cambia con esta migración.**

## Fidelidad

- **Lógica y números: exactos.** Se portan 1:1.
- **UI: sin cambios.** Solo cambia de dónde salen los datos. Se agrega un estado de
  "cargando" mínimo (ver §8).

---

## 1. El problema, en criollo

Hoy en el navegador están:

- El **capital, reputación y cabeza** como variables que se pueden reescribir.
- La **función `computeTitle()`**: se puede llamar para forzar cualquier final.
- El **RNG** (`seedAt` + `rnd`, xorshift sembrado con el código `MGN-XXXXX`). Como el
  código es público y el algoritmo también, **se puede simular la partida entera antes de
  jugarla** y elegir siempre la opción ganadora.
- **Información oculta que no debería estar**: el contenido de los tres sobres se sortea
  al apostar (`outcomes`), los rodillos finales antes de que frenen (`finalReels`), la
  respuesta correcta del Sillón (`ok`), la carta tapada de la banca en blackjack, y el
  orden completo de los 12 escenarios (`order`).
- El **ranking y la colección** en `localStorage`: se editan a mano.

Regla para el back: **el cliente nunca manda un número del juego**. Manda qué botón tocó.
Todo lo demás lo calcula el servidor y devuelve solo lo que el jugador ya debería ver.

---

## 2. Stack (decidido)

- **Base de datos: Supabase (Postgres)**, región **São Paulo (`sa-east-1`)**.
- **API: Supabase Edge Functions** (Deno + TypeScript), una sola función `api` con
  **Hono** como router.
- **Identidad: Supabase Auth, usuarios anónimos** (`signInAnonymously`). Cada jugador
  tiene un `auth.uid()` sin registrarse; si más adelante se vincula a una cuenta de LB,
  se hace `linkIdentity` sobre el mismo usuario y no se pierde nada.
- **Motor**: TypeScript puro, sin dependencias, importado por la Edge Function y por los
  tests. Tiene que correr igual en Deno y en Node.
- **Tests**: `deno test` (o Vitest en Node para `/engine` y `/sim`).
- **Front**: sigue siendo un HTML estático. Se hostea en Vercel, Netlify o Cloudflare
  Pages. Usa `@supabase/supabase-js` **solo para la sesión anónima**, nunca para leer
  o escribir tablas.

Estructura del repo:

```
/engine                 motor puro: tipos, datos, reglas, RNG. Cero dependencias.
  data.ts               SCENARIOS, BIG_SCENARIOS, EVENTS_*, QUIZ, TITLES, RAREZA, etc.
  rng.ts                hashStr, xorshift, derivación de semilla con HMAC
  rules.ts              incomeFor, yieldRate, bigThreshold, computeTitle, handVal…
  step.ts               reducer: (state, action, cfg) => state
  view.ts               toView(state): lo que se le puede mostrar al jugador
/supabase
  config.toml
  migrations/           SQL versionado (tablas, índices, RLS, vistas de ranking)
  functions/
    api/index.ts        Hono: todas las rutas de §6
    _shared/            cliente admin, auth, rate limit, errores
    rareza-job/         recálculo diario de RAREZA (cron)
/sim                    bots de estrategia + test de balance
/web                    front estático
```

---

## 2 bis. Supabase: reglas de seguridad (no negociables)

Supabase permite que el navegador lea y escriba tablas directo con la clave pública.
**Para este juego eso está prohibido**: sería volver al problema de hoy.

- **RLS activado en todas las tablas y sin ninguna policy** para `anon` ni
  `authenticated`. Resultado: la clave pública no puede leer ni escribir nada.
- Además, `revoke all` de las tablas para `anon` y `authenticated`.
- Solo la Edge Function accede a la base, con la **service role key**, que vive en los
  secrets de Supabase y **nunca** en el front ni en el repo.
- La Edge Function valida el JWT del usuario (`Authorization: Bearer <access_token>`)
  con `supabase.auth.getUser(token)` y usa ese `user.id` como `player_id`.
  **Nunca** aceptar un `playerId` que venga en el body.
- Activar en el dashboard: *Authentication → Anonymous sign-ins*, con **CAPTCHA
  (Cloudflare Turnstile)** para que un bot no cree miles de usuarios.
- Desactivar la **Data API (PostgREST)** para el schema `public` si no se usa, o
  mover las tablas a un schema `game` que no esté expuesto.
- CORS de la función: permitir solo el dominio del juego (y `localhost` en desarrollo).

Secrets de la Edge Function (`supabase secrets set`):

| Nombre | Qué es |
|---|---|
| `SERVER_SECRET` | Clave para derivar las semillas (§4). 32+ bytes aleatorios. **Si se filtra, se pueden predecir todas las partidas: rotarla invalida las partidas en curso.** |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Los inyecta Supabase solo. |
| `ALLOWED_ORIGINS` | Dominios permitidos para CORS, separados por coma. |
| `GAME_CONFIG` | JSON opcional con `rounds`, `startingCapital`, `eventChance`, `incomeBase`, `minigame`. Si falta, se usan los defaults del motor. |

Front (`/web`): solo `SUPABASE_URL` y la **anon key** (son públicas por diseño).

## 3. El motor: un reducer puro

Toda la lógica de la clase `Component` se convierte en una función:

```ts
step(state: RunState, action: Action, cfg: Config): RunState
```

Pura y determinista: mismo estado + misma acción = mismo resultado. Sin `setTimeout`,
sin `setState`, sin `localStorage`, sin `Math.random()`.

### 3.1 Acciones (lo único que el cliente puede mandar)

Mapean 1:1 a los handlers actuales:

| Acción | Handler actual | Payload | Válida cuando |
|---|---|---|---|
| `pick` | `pick(opt)` | `{ option: number }` índice en la lista de opciones mostrada (incluye la 4ª si hay) | fase `choose` |
| `continue` | `cont()` | — | hay `toast` |
| `eventPick` | `pickEvent(o)` | `{ option: number }` | fase `eventChoice` |
| `quizAnswer` | `responderQuiz(i)` | `{ option: 0\|1\|2 }` | quiz activo, sin respuesta |
| `quizNext` | `seguirQuiz()` | — | acertó y no es la última |
| `quizClose` | `cerrarQuiz()` | — | quiz terminado |
| `miniStake` | `setStake(frac)` | `{ frac: 0.1 \| 0.25 \| 0.5 }` (los valores que ofrece la UI; validar contra lista blanca) | mini en fase `stake` |
| `miniSkip` | `pasarMini()` | — | mini en fase `stake` |
| `slotsSpin` | `spin()` | — | mini `slots` en juego |
| `ruletaSpin` | `girarRuleta()` | — | mini `ruleta` en juego |
| `dobleDouble` / `dobleCashout` | `doblar()` / `retirar()` | — | mini `doble` en juego |
| `sobreOpen` | `abrirSobre(i)` | `{ index: 0\|1\|2 }` | mini `sobres` en juego |
| `bjHit` / `bjStand` | `pedirCarta()` / `plantarse()` | — | mini `blackjack`, no plantado |
| `miniFinish` | `finishMini()` | — | mini terminado |

Cualquier acción fuera de fase → `409` y el estado no cambia. **Verificar los valores
permitidos de `frac`** leyendo los botones de apuesta en el template del `.dc.html`.

### 3.2 Estado de la partida (`RunState`)

Es el `state` actual de la clase, **menos** todo lo de UI (`tab`, `storyOpen`, `copied`,
`dueloCopied`, `lbtag`, `unlocked`, `spinning`, `tick`, `locked`, `angle`). Más:

- `id`, `playerId`, `seedCode`, `serverSalt` (nunca sale del servidor)
- `rngState: number` — el estado del xorshift **persistido** entre acciones
- `version: number` — contador de acciones, para control de concurrencia
- `miniBag` — hoy es `this.miniBag` (fuera del state): pasa a ser parte del estado
- `status: 'active' | 'finished' | 'abandoned'`
- `ranked: boolean`

### 3.3 Timers → resultado inmediato

`spin()` y `girarRuleta()` hoy resuelven con `setTimeout` de 1,6 s y 2,65 s. En el
servidor **se resuelven al instante**: la respuesta trae el resultado final
(`reels`, `sector`, `delta`) y el front anima hasta ese resultado. El front ya calcula el
ángulo de la ruleta a partir de `sector`, así que eso se queda en el cliente.

### 3.4 Fuera del motor

Se quedan en el front porque son pura presentación: `fmt`, `pctf`, `smoothPath`,
`RULETA_COLOR`, `SHOW_HOST`, `SHOW_OK`, `shareText()`, `dueloUrl()`, y todo `renderVals()`.

---

## 4. Azar: semilla secreta y determinismo

El duelo necesita que dos jugadores con el mismo código vean los mismos escenarios. Eso
se mantiene, pero **la semilla deja de ser calculable desde afuera**:

```ts
// antes (front):  seed = hashStr(code + '|' + n)
// ahora (server): seed = u32(HMAC_SHA256(SERVER_SECRET, code + '|' + n))
```

- `SERVER_SECRET` es una variable de entorno. Sin ella nadie puede precalcular nada.
- Mismo esquema de re-sembrado que hoy: `n = 0` al empezar, `n = round + 1` en cada
  `pick`. Los minijuegos y eventos siguen consumiendo del mismo stream.
- El estado del RNG se **guarda con la partida** entre acciones (hoy es una global
  `RSTATE` que se pisa entre partidas).
- Mantener xorshift32 tal cual (`rnd()`), así las distribuciones son idénticas a las del
  balance.

> **Ojo con el duelo**: aunque la semilla sea secreta, alguien puede jugar un código,
> aprender qué pasa y rejugarlo. Por eso las partidas de duelo **no suman al ranking
> general** (ver §6) y en la tabla del duelo cuenta **solo el primer intento** de cada
> jugador.

---

## 5. Qué ve el cliente (`toView`)

La respuesta de cada acción es `{ view, version }`. `view` se arma con una función
explícita, **nunca serializando el estado entero**. Por defecto todo se oculta.

Sale:

- `screen`, `round`, `rounds`, `capital`, `rep`, `calma`, `caps`, `history`,
  `income`, `yieldGain`, `yieldRate`, `streak`, `paciencia`, `bonusPac`, `cuna`
- `current`: el escenario actual **con** sus opciones (incluida la 4ª desesperada/fina ya
  inyectada), sin `min`/`max`. El front no los muestra; mandarlos regala el EV.
  *(Confirmar leyendo el template: si alguna parte de la UI sí muestra rangos, mandar
  solo eso.)*
- `toast` completo (ya es post-resultado)
- `evChoice` sin `min`/`max`
- `quiz`: pregunta y opciones actuales. **`ok` y `why` solo después de responder.**
  Nunca las preguntas siguientes.
- `slots` (minijuego) según tipo:
  - `sobres`: **nunca `outcomes`** mientras no se abrió uno. Al abrir, se muestran los tres.
  - `slots`: `reels` solo después del giro. Nunca `finalReels` antes.
  - `blackjack`: la segunda carta de la banca oculta (`{hidden:true}`) hasta plantarse o
    pasarse. **Confirmar con el template** cómo se muestra hoy la mano de la banca y
    respetar eso, ocultando lo que no deba verse.
  - `doble`: `pot`, `step`.
  - `ruleta`: `sector` solo después del giro.
- Pantalla final: `titleKey`, `title`, `rareza`, `capital`, `challenge`.

No sale nunca: `order` (escenarios futuros), `bigUsed`, `showRound` (en qué ronda aparece
El Sillón), `rngState`, `serverSalt`, `miniBag`, `tagCounts`/`riskCounts` crudos (si la UI
los necesita para algún panel, mandar solo lo que el panel muestra).

---

## 6. API

Todas las respuestas en JSON. Errores con `{ error: { code, message } }` y mensajes en
castellano rioplatense listos para mostrar.

### Identidad

Sin registro obligatorio (decisión de producto: el registro nunca bloquea jugar ni
compartir). Al cargar, el front llama a `supabase.auth.signInAnonymously()` si no hay
sesión, y manda el `access_token` en cada request. El `player_id` es el `auth.uid()`.
El $LBtag se asocia después a ese usuario.

Todas las rutas viven bajo la función `api`:
`https://<proyecto>.supabase.co/functions/v1/api/...`. La función se despliega con
verificación de JWT activa, así que un request sin token ni siquiera llega al código.

### Endpoints

```
POST /api/runs                       crear partida
  body  { duelo?: "MGN-XXXXX" }
  resp  { runId, version, view }
  - sin duelo: el server genera el código (no el cliente)
  - con duelo: validar formato con la misma regex que cleanCode()
  - una sola partida activa por jugador: si hay otra, se marca 'abandoned'

GET  /api/runs/:id                   retomar (recarga de página)
  resp  { runId, version, view }

POST /api/runs/:id/actions           aplicar una acción
  body  { version, action: { type, ...payload } }
  resp  { version, view }
  - 404 si la partida no es del jugador
  - 409 si version no coincide (doble clic, dos pestañas) → el front refresca con GET
  - 409 si la acción no corresponde a la fase
  - escritura atómica con control optimista, sin transacción larga:
      update runs set state=$new, version=version+1, ...
      where id=$id and player_id=$uid and version=$v
    si afecta 0 filas → 409. El insert en run_actions va después (o todo junto en una
    función SQL `apply_action` llamada por RPC con la service role).

GET  /api/me                         { playerId, lbtag, unlocked: string[] }
PUT  /api/me/lbtag                   { lbtag }  → validar formato y unicidad
GET  /api/ranking?by=rareza|plata&period=semana|historico
GET  /api/duelos/:code               resultados del primer intento de cada jugador
```

### Reglas de ranking

- Solo cuentan partidas **terminadas en el servidor** (`status='finished'`), creadas sin
  `duelo` (`ranked=true`) y con $LBtag.
- El ranking **por rareza** (principal) ordena por la rareza del final; desempate por
  capital y después por fecha.
- El ranking **por plata** usa el capital final. Es el más fácil de "farmear" rejugando,
  así que conviene limitarlo por período (semana) y contar la mejor partida por jugador.
- La **colección** (`unlocked`) se escribe solo desde el server al terminar una partida.
- Reemplaza los mocks `RANKING_HIST`, `RANKING_PLATA` y `RANKING_DEMO_UNUSED`.
- `RAREZA` hoy es un número fijo de simulación. Dejarlo como seed y agregar un job
  (diario) que la recalcule con partidas reales, con un mínimo de muestra antes de
  reemplazar el valor simulado.

### Anti-abuso

- Rate limit por `player_id` e IP: creación de partidas (ej. 30/hora) y acciones (ej.
  5/seg). En Supabase se puede hacer con una tabla `rate_limits` y una función SQL
  atómica, o con Upstash Redis si hace falta más volumen. Una partida humana tiene ~12–40 acciones; más de 200 es un bot.
- Duración mínima plausible: marcar (no bloquear) partidas terminadas en menos de ~40 s;
  quedan fuera del ranking hasta revisión.
- Partidas activas sin acciones por 24 h → `abandoned`.
- Nada de lo que viene del cliente se interpola en SQL ni en HTML (el $LBtag sale en el
  ranking de todos: sanitizar).

---

## 7. Base de datos (migración SQL)

```sql
create table players (
  id uuid primary key references auth.users(id) on delete cascade,
  lbtag text unique check (lbtag ~ '^[a-z0-9._]{3,20}$'),
  created_at timestamptz not null default now()
);

create table runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  seed_code text not null check (seed_code ~ '^MGN-[A-Z0-9]{5}$'),
  ranked boolean not null,
  status text not null default 'active' check (status in ('active','finished','abandoned')),
  state jsonb not null,
  version int not null default 0,
  final_key text, final_capital bigint, quiebra boolean,
  actions_count int not null default 0,
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index one_active_run on runs(player_id) where status = 'active';
create index runs_duelo on runs(seed_code, player_id, created_at);
create index runs_rank on runs(final_key, final_capital desc) where status = 'finished' and ranked and not flagged;

create table run_actions (
  run_id uuid references runs(id) on delete cascade,
  seq int, action jsonb not null,
  created_at timestamptz not null default now(),
  primary key (run_id, seq)
);

create table unlocks (
  player_id uuid references players(id) on delete cascade,
  final_key text, first_run uuid references runs(id),
  created_at timestamptz not null default now(),
  primary key (player_id, final_key)
);

create table rareza (
  final_key text primary key, pct numeric not null,
  sample int not null default 0, updated_at timestamptz not null default now()
);  -- se siembra con los valores de RAREZA del motor

alter table players     enable row level security;
alter table runs        enable row level security;
alter table run_actions enable row level security;
alter table unlocks     enable row level security;
alter table rareza      enable row level security;
revoke all on players, runs, run_actions, unlocks, rareza from anon, authenticated;
-- sin policies: solo la service role (Edge Function) accede
```

El índice `one_active_run` garantiza una sola partida activa por jugador: al crear una
nueva, primero marcar la anterior como `abandoned`.

El ranking conviene armarlo como **vista materializada** refrescada cada pocos minutos
(`pg_cron`), con la mejor partida por jugador: así el `GET /ranking` no recorre todas
las partidas.

`run_actions` permite **reproducir cualquier partida** desde la semilla: si alguien
aparece con un resultado raro, se re-ejecuta y se compara.

Montos: capital en **enteros de pesos** (`bigint`). El motor hoy trabaja con decimales
intermedios y redondea al mostrar; al persistir, guardar el valor tal cual lo tiene el
motor (float) en `state` y el redondeado en `final_capital`. No redondear en el medio o
cambia el balance.

---

## 8. Cambios en el front

1. Borrar del cliente: `SCENARIOS`, `BIG_SCENARIOS`, `EVENTS_*`, `QUIZ`, `DESESPERADAS`,
   `FINAS`, `TAG_EFFECT`, `COMMIT`, `TAG_PESO`, `FIRMA_*`, el RNG, `computeTitle()` y
   todos los handlers con lógica.
2. Quedan: `TITLES` (texto e ícono de los finales, para la colección), `RAREZA` (o
   pedirla a la API), `TAG_LABEL`, formateadores y presentación.
3. Cada handler pasa a ser `await api.act({type, ...})` y guarda el `view` recibido.
4. Guardar `runId` en `sessionStorage` y al cargar hacer `GET /api/runs/:id` para
   retomar si se recargó la página.
5. **Estado de envío**: mientras hay un request en vuelo, deshabilitar los botones (evita
   doble acción). No mostrar spinner si tarda menos de ~300 ms.
6. Error de red: mensaje corto en tono del juego con "Reintentar", sin perder la partida.
7. Animaciones de tragamonedas y ruleta: arrancan al tocar, y frenan en el resultado que
   devolvió el server. El front ya tiene los tiempos (640/1000/1360 ms rodillos,
   2650 ms ruleta); mantenerlos.
8. Props tweakeables (`rounds`, `startingCapital`, `eventChance`, `incomeBase`,
   `minigame`) pasan a ser **config del servidor** (`Config`), no del cliente.
9. `localStorage` (`elmagnate.finales`, `elmagnate.lbtag`) → migración: al primer
   `GET /api/me`, si el server no tiene nada y hay datos locales, **no importarlos**
   al ranking (no son confiables); sí se puede mostrar la colección local como "de antes".

---

## 9. Plan por fases

**Fase 1 — Motor puro + tests** (lo más importante)
- Portar a `/engine` sin cambiar números. Tipar todo.
- Test de golden: con `SERVER_SECRET` fijo y una secuencia de acciones fija, el estado
  final es siempre el mismo (snapshot).
- Test de paridad: con la semilla vieja (`hashStr`), el motor portado debe dar
  **exactamente** los mismos resultados que el código original para las mismas
  acciones. Correr el original en Node extrayendo el bloque de `<script data-dc-script>`.
- Bots de estrategia en `/sim` (conservador, medio, agresivo, mixto, azar,
  siempre-el-manotazo), 4.000 partidas cada uno. Comparar con la tabla de
  `balance-y-diseno.md` §8, **reescalada ×100** (el juego ahora está en pesos: capital
  inicial $500.000). Tolerancia ±10% relativa en medianas y ±1 punto en porcentajes.
- Invariantes en cada paso: sin `NaN`, capital ≥ 0, `rep`/`calma` en 0–100, toda
  partida termina, los 19 finales son alcanzables, ninguna acción válida tira error.

**Fase 2 — Supabase + API**
- `supabase init`, migración de §7, función `api` con las rutas de §6.
- Auth anónima, validación de JWT, control de versión, CORS, secrets.
- Sin Docker: no usar `supabase start`. Probar contra un **segundo proyecto de Supabase
  "el-magnate-dev"** (gratis) y recién después aplicar migraciones y deploy al proyecto
  real `ayyfmyixljjtxkfvyhsz`. Preguntarle a la persona antes de tocar el real.
- Test de seguridad: con la anon key, intentar `select`/`insert` en cada tabla desde
  supabase-js y verificar que **todo** falla.
- Tests de integración: partida completa por HTTP; doble envío con la misma versión;
  acción fuera de fase; partida ajena; `toView` nunca incluye los campos prohibidos
  (§5) — hacer un test que recorra todas las fases y busque esas claves en el JSON.

**Fase 3 — Front conectado**
- Cambios de §8. La UI tiene que verse idéntica a `referencia/deploy-actual.html`.

**Fase 4 — Ranking, colección, duelos reales**
- Reemplazar mocks. Vista materializada del ranking. Función `rareza-job` con
  `pg_cron` diario. Rate limits, CAPTCHA en el login anónimo y flags.

**Fase 5 (opcional) — Imagen de la story**
- El botón "Descargar" de la carta 9:16 hoy es maqueta. Generarla en el server
  (Satori / `og_edge` dentro de una Edge Function) a partir de `runId` terminado, así la imagen que se
  comparte también es verificable.

---

## 10. Criterios de aceptación

- Desde la consola del navegador **no se puede** cambiar capital, forzar un final,
  ver el contenido de los sobres, la respuesta del Sillón ni los escenarios futuros.
- Con el código de duelo y el código fuente del front **no se puede** predecir ninguna
  tirada.
- Dos jugadores con el mismo código de duelo ven los mismos 12 escenarios y, ante las
  mismas decisiones, obtienen el mismo resultado.
- La tabla de balance de los bots coincide con la de referencia.
- Recargar la página a mitad de partida la retoma donde estaba.
- El ranking solo muestra partidas jugadas de punta a punta en el servidor.
- Con la anon key de Supabase no se puede leer ni escribir ninguna tabla.
- La service role key y `SERVER_SECRET` no aparecen en el front, en el repo ni en logs.

## 11. Pendientes de diseño que no resuelve este backend

(De `balance-y-diseno.md` §10, siguen abiertos.)
- La reputación sube casi sola; falta decaimiento.
- El conservador tiene 0% de llegar al techo. Intencional, pero decisión abierta.
- Verificación del $LBtag contra una cuenta real de LB: fuera de alcance acá; el tag hoy
  es declarativo. Si LB tiene login, se vincula con `linkIdentity` sobre el usuario
  anónimo y `PUT /api/me/lbtag` pasa a tomar el tag de esa cuenta.

---

## 12. Qué hace la persona (no Claude Code)

Claude Code no puede crear cuentas ni aceptar términos. Antes de la Fase 2 hace falta:

1. Crear el proyecto en supabase.com, región **South America (São Paulo)**.
   ✅ Hecho. **Project ref: `ayyfmyixljjtxkfvyhsz`**.
2. Autenticar la CLI con `npx supabase login` (abre el navegador; no hace falta pegar
   ningún token) y después `npx supabase link --project-ref ayyfmyixljjtxkfvyhsz`.
   **Claude Code: generá vos `SERVER_SECRET` (32 bytes aleatorios) y cargalo con
   `supabase secrets set`; no lo muestres en pantalla ni lo escribas en archivos.**
   Nunca guardar tokens `sbp_...` ni claves en el repo.
3. ✅ *Anonymous sign-ins* y **Cloudflare Turnstile** (CAPTCHA). Pedirle a la persona la
   **Site Key** (pública) para el front; la Secret Key va solo en el dashboard de Supabase.
4. Elegir dónde va el front (Vercel / Netlify / Cloudflare Pages) y el dominio final,
   para el CORS.
5. ✅ Node instalado (macOS, Apple Silicon). **Sin Docker**: usar el proyecto
   "el-magnate-dev" para probar (ver Fase 2). Deno y la CLI de Supabase los instala
   Claude Code (`npx supabase`). La persona no es técnica: explicarle cada paso que
   tenga que hacer ella, en castellano y sin jerga.
6. GitHub: opcional por ahora. Si no hay repo, trabajar con git local y avisar cuando
   convenga subirlo.
