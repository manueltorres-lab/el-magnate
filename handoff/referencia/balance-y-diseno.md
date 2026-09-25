# El Magnate — cambios para aplicar al artefacto original

Pegale esto a Claude junto con tu artefacto. Está escrito para que pueda aplicarlo sin
volver a inventar el balance: todos los números salen de simular ~60.000 partidas
ejecutando el código real del juego.

---

## Contexto para Claude

> Tengo un juego de simulación financiera en HTML ("El Magnate", de LB Finanzas, en
> español rioplatense). Se testeó a fondo con simulaciones y se rebalanceó. Abajo están
> los cambios exactos a aplicar sobre mi artefacto. Aplicalos todos, respetando los
> números tal cual están: cada uno está calibrado y cambiarlos rompe el balance.
> El punto 7 bis tiene el sistema visual completo (paleta, tipografía, formas, layout,
> movimiento) por si necesitás construir las pantallas nuevas. Mantené mi tono de copy.
> Todo el estilo va **inline**: sin clases CSS, sin hojas de estilo; lo único que va en
> un `<style>` son los `@keyframes`, las fuentes y el reset del body.

---

## 1. Problemas que se corrigieron (el por qué)

| Problema | Diagnóstico |
|---|---|
| El riesgo alto era la respuesta correcta siempre | Rendía +24% esperado por ronda con quiebra casi imposible (0,3%). No había decisión. |
| Reputación y Cabeza eran decorativas | No hacían nada más que desbloquear un título. |
| Tres finales inalcanzables | Pedían 3 decisiones de un tag que aparecía en 2 de 28 escenarios. |
| El orden de los finales tapaba lo importante | Con $6M y jugadas arriesgadas salía "Temerario", nunca "El Imperio". |
| Un final se comía el 70% de las partidas | La banda media no distinguía perfiles de juego. |
| Los sobres pagaban +53% esperado | "Apostar fuerte" era siempre óptimo. |

---

## 2. Balance económico

**Compromiso de capital por riesgo** — cuánto del capital se pone en juego:

```js
const COMMIT = {baja: 0.2, media: 0.5, alta: 0.85};
```

**Rangos de resultado.** Regla usada para recomprimir los 58 rangos del banco: el techo
de cada opción es `|min| + spread`, donde el spread se reduce al 30% del original en
riesgo alto y al 45% en riesgo medio (en los escenarios de "grandes ligas", 16,5% en
alto). Resultado promedio del banco:

- **baja**: `min: +2, max: +6` → EV +0,8% del capital. Nunca pierde.
- **media**: `min: -29, max: +36` → EV +1,8% del capital.
- **alta**: `min: -90, max: +103` → EV +5,7% del capital, con varianza brutal.

**Motor de crecimiento** (reemplaza el rendimiento fijo del 7%):

```js
get incomeBase(){ return this.props.incomeBase ?? 2600; }

// el ingreso por ronda escala, y la reputación lo modula ±28%
incomeFor(r, rep){
  return Math.round(this.incomeBase * (1 + 0.55*r) * (1 + ((rep ?? this.state.rep) - 50)/180));
}

// el rendimiento compuesto premia jugar prudente: 6% base → hasta 13%
yieldRate(){
  const s = this.state;
  return 0.06 + 0.009*(s.riskCounts.baja||0) + (s.calma > CALMA_ALTA ? 0.02 : 0);
}
```

**Racha**: dos ganancias seguidas hacen que la tercera valga ×1,6.

---

## 3. Reputación y Cabeza: que hagan algo

Antes eran barras decorativas. Ahora cada una tiene efectos concretos, y el panel
muestra debajo de cada medidor qué efecto está activo en ese momento.

**Reputación** (0–100, arranca en 50):
- Multiplica cada ganancia: `×(1 + (rep-50)/250)` → ±20%.
- Modula el ingreso por ronda (ver `incomeFor`) → ±28%.
- Baja el umbral de acceso a los escenarios grandes:

```js
bigThreshold(rep){
  return Math.max(90000, Math.round(150000 - ((rep ?? this.state.rep) - 50)*1200));
}
```

- **Fallar en grande se ve**: si una jugada de riesgo alto pierde plata, `rep -= 5`.

**Cabeza** (0–100, arranca en 50):
- Por debajo de 25: las pérdidas pegan ×1,3.
- Por encima de 75: las pérdidas se cortan ×0,85.
- Por encima de 70: +2% de rendimiento.
- **Recuperación por descanso** entre rondas, empuja hacia 50:

```js
const rested = clamp(s.calma + Math.round((50 - s.calma) * 0.16));
```

> El 0,16 es crítico. Con 0,30 la stat se congela en 50 y las opciones condicionadas
> del punto 4 nunca aparecen (medido: 0 apariciones en 3.500 partidas).

**Efectos por tag de decisión** (se aplican ANTES de calcular el resultado, para que el
texto del resultado y el panel muestren siempre el mismo número):

```js
const TAG_EFFECT = {
  conservative:{rep:0,  calma:5},   moderate:{rep:1, calma:1},
  aggressive:{rep:2,  calma:-8},    business:{rep:3, calma:-5},
  debt:{rep:1, calma:-10},          realestate:{rep:2, calma:2},
  education:{rep:4, calma:3},       networking:{rep:5, calma:-2},
  philanthropy:{rep:6, calma:6},    consumption:{rep:-7, calma:14}
};
```

---

## 4. Opciones que aparecen según tu Cabeza

La mecánica más importante que se agregó. **No filtra las opciones existentes** —
eso genera una espiral de muerte (cabeza baja → te fuerza a riesgo alto → te baja más
la cabeza) y en 11 de 40 escenarios dejaría una sola salida. En cambio **suma una
cuarta opción**, marcada con una etiqueta explícita, y las tres normales siguen ahí.

```js
const CALMA_BAJA = 30, CALMA_ALTA = 70;

// con la cabeza quemada aparece el manotazo de ahogado
const DESESPERADAS = [
  {label:"Vas por todo con lo que te queda", icon:"🎲", tag:"aggressive", risk:"alta",
   min:-100, max:118, desc:"No lo pensás. Empujás todas las fichas de una.", extra:"ahogado"},
  {label:"Pedís plata prestada para recuperarte", icon:"⚡", tag:"debt", risk:"alta",
   min:-100, max:122, desc:"Recuperar lo perdido, sea como sea y a quien sea.", extra:"ahogado"},
  {label:"Liquidás todo y apostás a una sola carta", icon:"🃏", tag:"aggressive", risk:"alta",
   min:-100, max:115, desc:"Una jugada, una sola, y que decida el destino.", extra:"ahogado"}
];

// con la cabeza clara aparece la jugada fina
const FINAS = [
  {label:"Esperás el momento justo y entrás quirúrgico", icon:"🎯", tag:"moderate", risk:"media",
   min:-18, max:42, desc:"Viste algo que con la cabeza cansada no se ve.", extra:"fina"},
  {label:"Negociás mejores condiciones antes de entrar", icon:"🤝", tag:"networking", risk:"media",
   min:-16, max:40, desc:"La calma te da margen para pedir más.", extra:"fina"},
  {label:"Armás la posición de a poco, sin apuro", icon:"📐", tag:"moderate", risk:"media",
   min:-15, max:38, desc:"Promediás la entrada como un profesional.", extra:"fina"}
];
```

Inyección, al construir la lista de opciones de la ronda:

```js
let pool = sc.options || [];
if(s.calma < CALMA_BAJA)      pool = [...pool, DESESPERADAS[s.round % 3]];
else if(s.calma > CALMA_ALTA) pool = [...pool, FINAS[s.round % 3]];
```

Cada opción extra se muestra con borde propio (rojo / verde) y un chip que dice
`MANOTAZO DE AHOGADO · TU CABEZA ESTÁ QUEMADA` o
`JUGADA FINA · SOLO CON LA CABEZA CLARA`.

**Está medido que no es explotable**: el bot que siempre agarra la opción condicionada
es la peor estrategia del juego — se funde el 19,5% de las veces y su mediana cae a
$94k, aunque tiene buena chance de millón. La tentación paga peor que la disciplina.

---

## 5. Banco de contenido

Se amplió de 28 a **40 escenarios**, cubriendo los 7 perfiles que estaban huérfanos
(ladrillo, negocio propio, deuda, contactos, estudio, filantropía, consumo), más
salidas de riesgo alto en 4 escenarios que no tenían ninguna.

Totales actuales: **40 escenarios** · 5 de grandes ligas · 26 eventos automáticos ·
**13 eventos condicionales** (ningún tag sin evento) · 6 eventos con decisión ·
3 desesperadas · 3 finas.

Chequeos de integridad que conviene mantener al agregar contenido:
- Ningún escenario con menos de 2 opciones.
- Ningún escenario donde todas las opciones tengan el mismo riesgo.
- Todo `tag` debe existir en `TAG_EFFECT`; todo `min <= max`; nada sin `desc` ni `icon`.
- Ningún texto de escenario duplicado.
- Cada tag de perfil debe aparecer en ≥8 de 40 escenarios, o su final es inalcanzable.

**Minijuegos** con EV honesto (antes los sobres pagaban +53%):
- Tragamonedas: 3 iguales ×6, 2 iguales ×0,8, nada = se va el pozo. EV −5,6%.
- Doble o nada: matemáticamente justo, tope en 4 pasos.
- Tres sobres: ×1,8 / −0,3× / −1×. EV +17%.

---

## 6. Finales: 18, todos alcanzables

Se agregaron 5 finales por perfil dominante porque el 70% de las partidas caía en un
solo título. **El orden importa**: lo más raro se evalúa primero.

```js
computeTitle(){
  const s = this.state, cap = s.capital, tc = s.tagCounts, rc = s.riskCounts;
  if(s.quiebra) return TITLES.quiebra;
  if(cap >= 5000000) return TITLES.imperio;
  if(cap >= 1000000 && s.calma < 15) return TITLES.insomne;
  if(cap >= 1000000) return TITLES.magnate;
  if((rc.alta||0) >= 9) return TITLES.temerario;
  if((tc.philanthropy||0) >= 2 && !(tc.consumption||0)) return TITLES.generoso;
  if((tc.consumption||0) >= 2) return TITLES.disfruton;
  if((tc.education||0) >= 2 && cap >= 100000) return TITLES.estudioso;
  if(cap < 25000) return TITLES.perdido;
  if(cap < 100000) return TITLES.zafando;
  if(cap >= 500000) return TITLES.independencia;
  // la banda media se resuelve por perfil dominante, no por plata
  const dom = Object.entries(tc).sort((a,b) => b[1]-a[1])[0];
  const byProfile = {
    realestate: TITLES.ladrillo, debt: TITLES.equilibrista,
    business: TITLES.emprendedor, networking: TITLES.referente,
    conservative: TITLES.constructor, aggressive: TITLES.pulso
  };
  if(dom && dom[1] >= 3 && byProfile[dom[0]]) return byProfile[dom[0]];
  if(s.rep >= 78) return TITLES.referente;
  return TITLES.deberes;
}
```

Los 5 finales nuevos:

```js
ladrillo:{title:"El Rey del Ladrillo", icon:"🧱", blurb:"Todo tu patrimonio tiene paredes, techo y escritura."},
equilibrista:{title:"El Equilibrista", icon:"🎪", blurb:"Viviste apalancado doce rondas y llegaste entero. Casi."},
emprendedor:{title:"El Que Se La Jugó por lo Suyo", icon:"🏗️", blurb:"No invertiste en el mercado: construiste algo."},
pulso:{title:"El Pulso Firme", icon:"🫀", blurb:"Arriesgaste como el que más, y nunca te tembló la mano."},
deberes:{title:"El Que Hizo los Deberes", icon:"📋", blurb:"Sin épica y sin desastre. Cumpliste, que no es poco."},
```

---

## 7. Capa viral (lo nuevo de producto)

**Rareza medida, no inventada.** Sale de simular 7.000 partidas con perfiles de jugador
variados. Es la base del ranking y del copy de compartir.

```js
const RAREZA = {
  imperio:0.2, perdido:0.2, equilibrista:0.2, insomne:0.5, referente:0.7, ladrillo:0.9,
  emprendedor:1.7, generoso:1.9, pulso:2.2, quiebra:2.4, estudioso:3.1, magnate:3.8,
  zafando:5.5, disfruton:7.1, independencia:7.1, deberes:8.8, temerario:12.7, constructor:41.1
};
```

**El ranking ordena por rareza del final, no por capital.** Decisión deliberada: un
ranking por plata lo gana quien más reintenta (el p95 del juego agresivo es 30 veces la
mediana y una partida dura 12 rondas), y no se puede defender. Ordenar por rareza premia
llegar a un final difícil.

**El $LBtag es opcional y nunca bloquea el compartir.** Registro y share compiten por el
mismo segundo de atención: si pedís cuenta en el pico de dopamina, perdés las dos cosas.
Compartir es siempre libre; el tag es la puerta al ranking y firma la carta, con un
"No tengo, quiero uno" al lado. Se guarda en `localStorage` y se pide una sola vez.

**Pantalla final con 3 pestañas**: Tu carta · Ranking · Colección.
- Carta con rareza del final y barra de progreso.
- Carta en formato story 9:16 para bajar y subir a redes.
- Copy de compartir listo para pegar:
  `Me salió "El Estudioso" 📚 / Solo el 3,1% de los jugadores termina acá. / ¿Vos qué tan lejos llegás? / El Magnate · el simulador de LB Finanzas`
- Colección de los 18 finales, con candado en los que faltan, persistida en `localStorage`.
- Código de desafío (`MGN-XXXXX`) para pasarle la misma partida a un amigo.
- CTA a LB que **no promete rendimientos** — habla de habilidades:
  *"Acá la plata era de mentira. Tu cabeza para decidir, no."*

---

## 7 bis. Sistema visual (aplicar tal cual)

Identidad LB sobre fondo oscuro. **Todo el estilo va inline**, sin clases CSS.

### Paleta

| Rol | Valor | Dónde |
|---|---|---|
| Fondo de página | `#100a18` | `html, body` |
| Halo violeta | `radial-gradient(1200px 600px at 78% -8%, rgba(133,85,255,.22), transparent 60%)` | sobre el fondo de página |
| Panel / tarjeta | `#180f24` | paneles laterales, bloques de info |
| Panel de resultado | `#1b1226` | pantalla de resultado de la jugada |
| Botón de opción | `#1a1125` | las opciones de cada escenario |
| Verde acento (positivo) | `#73ffa1` | plata, aciertos, CTA principal |
| Tinta sobre verde | `#0d3320` | texto de los botones verdes |
| Rojo (negativo) | `#ff8a9b` | pérdidas, cabeza quemada, manotazo |
| Violeta marca | `#8555ff` | barra de reputación, botón del ranking |
| Violeta claro | `#cbb4ff` | etiquetas sobre bloques violetas |
| Texto principal | `#fbfafd` | títulos y cuerpo |
| Texto secundario | `rgba(244,233,254,.68)` | descripciones |
| Etiquetas | `rgba(244,233,254,.5)` | rótulos en mayúsculas |
| Bordes | `rgba(244,233,254,.14)` | todos los paneles |

En el código conviene tenerlos como constantes:

```js
const GREEN = '#73ffa1', RED = '#ff8a9b', DIM = 'rgba(244,233,254,.7)';
```

**Contraste**: ningún texto informativo por debajo de alfa `.55`. Hubo que subir dos
veces valores de `.32`/`.42` a `.55`/`.62` por contraste insuficiente. Las notas al pie
("Tabla ilustrativa", disclaimers) son la única excepción a `.4`.

### Tipografía

Una sola familia: **Plus Jakarta Sans** (400/500/600/700/800), desde Google Fonts.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Reglas de uso:
- **Todo número lleva `font-variant-numeric: tabular-nums`.** Es lo que evita que el
  capital "salte" al cambiar de valor. Aplica a montos, porcentajes, stats, contadores.
- Títulos: `font-weight:800` + `letter-spacing:-.03em` + `line-height:1.15`.
- Cifras grandes: `font-weight:700` + `letter-spacing:-.02em`.
- Rótulos en mayúsculas: `font-size:10px`, `letter-spacing:.14em`, alfa `.5`.
  (En el resultado de jugada: `11px` / `.16em`.)
- Cuerpo: `line-height:1.5–1.55` y `text-wrap:pretty`; títulos con `text-wrap:balance`.
- Ancho de lectura acotado con `max-width:44ch` a `60ch`, nunca en píxeles.

### Formas y espaciado

- Radios: `22px` la carta coleccionable · `16–18px` paneles · `14px` botones grandes ·
  `12px` botones chicos · `10px` cuadraditos de ícono · `99px` píldoras y barras.
- Bordes: siempre `1px solid rgba(244,233,254,.14)`, salvo estados que piden color.
- Padding: `16–18px` en paneles, `18–20px` en botones grandes.
- Separación entre bloques: `gap:10–12px`; entre columnas `gap:18px`.
- Barras de medidor: `height:5px`, pista `rgba(244,233,254,.12)`, radio `99px`.

### Layout

Dos columnas que se apilan solas en mobile, sin media queries:

```html
<div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;">
  <div style="flex:1 1 420px;min-width:0;">…escenario…</div>
  <div style="flex:1 1 250px;min-width:0;">…panel de estado…</div>
</div>
```

El `min-width:0` es obligatorio en cada columna flex o los textos largos desbordan.
La grilla de la colección: `repeat(auto-fill, minmax(148px,1fr))`.
Todo con flex/grid + `gap`, nunca márgenes por elemento.

### Movimiento

Dos animaciones, nada más. Van en `<style>` porque los `@keyframes` no pueden ser inline:

```css
@keyframes mgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes mgPop{from{opacity:0;transform:scale(.9) rotate(-6deg)}to{opacity:1;transform:scale(1) rotate(0)}}
```

`mgIn .26s ease` al entrar cada pantalla; `mgPop` para la carta final. Los botones:
`transition:border-color .14s, background .14s`, hover que aclara el borde a
`rgba(115,255,161,.5)`, y `transform:scale(.99)` al presionar.

### La carta coleccionable

Es la pieza que la gente comparte, así que se distingue del resto: doble degradado
(brillo diagonal + violeta de marca) en vez de fondo plano.

```css
background:
  linear-gradient(165deg, rgba(255,255,255,.14), rgba(255,255,255,.02) 48%),
  linear-gradient(160deg, #5632b2, #2a1350);
```

Lleva "LB FINANZAS" arriba, el ícono del final grande, el título, la rareza en verde, el
capital final y el `$LBtag` firmado en una píldora con borde verde.

La versión story es la misma carta en `aspect-ratio:9/16`, con las tipografías en
`clamp()` sobre unidades `vh` para que nada se recorte al encoger.

### Estados de las opciones condicionadas

La opción extra se distingue por borde y chip, no por posición:

```js
// manotazo: borde rgba(255,138,155,.5) · chip fondo rgba(255,138,155,.2), texto #ff8a9b
// jugada fina: borde rgba(115,255,161,.5) · chip fondo rgba(115,255,161,.16), texto #73ffa1
```

El chip: `font-size:10px`, `font-weight:700`, `letter-spacing:.1em`, `radius:6px`.

### Detalle de datos

El gráfico de capital es una **curva suave** (no una polilínea) con degradado verde
100→0 por debajo. Nunca ejes ni grilla: solo la forma de la trayectoria.

---

## 8. Resultado del balance (para no romperlo)

Probabilidad de llegar al millón, 4.000 partidas por perfil:

| Cómo juega | ≥$1M | ≥$5M | Mediana | Quiebra |
|---|---|---|---|---|
| Siempre conservador | 0,0% | 0% | $254.728 | 0,0% |
| Siempre riesgo medio | 0,1% | 0% | $225.490 | ~1% |
| Mixto (1 de cada 3 agresiva) | 2,4% | 0,03% | $213.865 | ~3% |
| Al azar | 3,1% | 0,05% | $236.239 | ~5% |
| Siempre agresivo | 9,1% | 0,95% | $134.051 | ~10% |
| Agresivo + siempre el manotazo | 6,4% | 0,53% | $94.320 | 19,5% |

**Jugador realista: 3,5% de llegar al millón** (uno cada 29) y 0,13% al Imperio.

Ninguna estrategia domina: el conservador tiene la mejor mediana y techo cerrado, el
agresivo triplica su chance de millón pero paga con la mediana y la quiebra.

---

## 9. Detalles de pulido que conviene no perder

- **Formato rioplatense**: montos con separador de miles (`$1.520`) y porcentajes con
  coma decimal (`+2,7%`, `×1,6`). Conviene un helper `pctf()`.
- **Matemática visible**: cada resultado explica qué pasó —
  *"Comprometiste $1.520 y el resultado fue +2,7%. Tu reputación sumó un 9%."*
- **Coherencia de stats**: calcular rep/cabeza nuevos ANTES del resultado, así el texto
  y el panel nunca muestran dos números distintos para la misma stat.
- **Contraste**: texto informativo nunca por debajo de alfa .55 sobre el fondo oscuro.
- **Overlay de la story**: columna flex donde los botones reservan su espacio
  (`flex:0 0 auto`) y la carta encoge (`flex:0 1 auto` + `min-height:0`). No fijar la
  altura con `aspect-ratio` sobre un ancho duro: los botones quedan fuera de pantalla en
  viewports bajos. Salidas: ✕ arriba, clic en el fondo, botón Cerrar.
- **Eventos de resultado nulo**: si la plata no se movió, decirlo
  (*"La plata quedó donde estaba. Lo que se movió fue otra cosa."*), no mostrar "$0".

---

## 10. Pendientes reales

1. **Desafío determinista** (lo más valioso). Hoy el código y el link se generan pero no
   pasan la partida. Hay que derivar el orden de escenarios de una semilla, para que dos
   jugadores recorran los mismos 12 escenarios y la comparación sea justa. Es el único
   loop de crecimiento real del juego.
2. **Ranking y "Descargar" la story son maqueta** — necesitan backend y generación de
   imagen.
3. **La reputación sube casi sola** en todas las estrategias (termina entre 52 y 71).
   Falta decaimiento por inactividad: que baje si dejás de hacer jugadas que la sostengan.
4. **El conservador tiene el millón en 0,0% exacto.** Su techo real es ~$400k. Es
   intencional, pero es una decisión de diseño abierta.
5. **Tomato Grotesk no está cargada** (falta el .woff2); todo va en Plus Jakarta Sans.

---

## Cómo verificar que no se rompió nada

Vale la pena instanciar la lógica del juego con un `setState` sincrónico y jugar cientos
de partidas por los mismos caminos que la UI, con bots de estrategia (siempre
conservador / medio / agresivo / mixto / azar / siempre-el-manotazo). Chequear en cada
pantalla: nunca dos vistas simultáneas, ningún `NaN` ni `undefined` en los textos, ningún
escenario sin salida, ningún bucle, que toda partida llegue al resultado, que los 18
finales sean alcanzables, y que las opciones condicionadas no se filtren al estado
equivocado.
