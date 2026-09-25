# Simulación de balance

Bots que juegan con lo mismo que ve un jugador (`toView`) y la tabla que sale de 4.000
partidas por estrategia, con semillas HMAC como en producción.

## Bots

| Bot | Escenarios | Eventos con decisión | Minijuegos |
|---|---|---|---|
| conservador | siempre riesgo bajo | la opción segura | no juega |
| medio | siempre riesgo medio (o el más cercano) | la de riesgo | apuesta 12% |
| mixto | 1 de cada 3 agresiva, el resto media | al azar | apuesta 12% |
| azar | cualquier opción | al azar | al azar |
| agresivo | siempre riesgo alto | la de riesgo | apuesta 25%, dobla hasta el final |
| manotazo | agresivo + siempre la opción condicionada si aparece | la de riesgo | apuesta 25% |

En El Sillón todos "saben" la respuesta el 60% de las veces (si no, contestan al azar).
Blackjack: piden carta por debajo de 17. Doble o nada: los prudentes se retiran después
del primer doble.

## Tabla actual (código de `El Magnate.dc.html`, montos en pesos)

`node sim/run.ts 20000` — "millón" = $100M, "imperio" = $500M (la tabla del documento ×100).

| Cómo juega | ≥$100M | ≥$500M | Mediana | Quiebra |
|---|---|---|---|---|
| conservador | 5,3% | 0,00% | $38.008.962 | 0,0% |
| medio | 4,0% | 0,03% | $25.961.559 | 0,3% |
| mixto | 8,8% | 0,43% | $23.815.388 | 1,9% |
| azar | 9,9% | 0,53% | $27.564.234 | 1,6% |
| agresivo | 11,8% | 2,38% | $10.518.941 | 17,2% |
| manotazo | 8,5% | 1,76% | $5.944.506 | 30,8% |

Los 19 finales salen (el más raro, *El Que Tenía Todo Servido*, en ~0,26% de las partidas).

`sim/baseline.json` guarda esta tabla (20.000 partidas por bot). `sim/balance.test.ts`
vuelve a jugar 4.000 partidas por bot **con otras semillas** y exige ±10% relativo en la
mediana y ±1 punto en cada porcentaje (o 3 errores estándar si es más: con ~30% de quiebra,
±1 punto es menos que el ruido de 4.000 partidas). Si alguien toca un número del balance,
se entera.

## ⚠️ Diferencia con la tabla de `balance-y-diseno.md` §8

La tabla del documento **no coincide** con el código de referencia, y no es un error del
port: el test de paridad demuestra que el motor da exactamente lo mismo que el original.
La tabla es de una versión anterior del juego. El código actual (el `.dc.html` y también
`deploy-actual.html`) agregó después, entre otras cosas:

- la **bonificación por paciencia** al cierre (`bonusPaciencia`: ×1,155 por cada ronda
  seguida sin perder plata a partir de la 4ª, hasta ×3,66 con 12 rondas),
- **El Sillón** (preguntas), **ruleta** y **blackjack**,
- la **quiebra** por debajo de $40.000, y la **cuna** (1% arranca con $6M).

Prueba hecha: desactivando solo la bonificación por paciencia (en una copia descartable),
los bots vuelven a dar la tabla del documento dentro de la tolerancia en las filas
principales:

| Bot | Doc ×100 (≥$100M / mediana) | Sin paciencia | Con paciencia (actual) |
|---|---|---|---|
| conservador | 0,0% / $25.472.800 | 0,0% / $27.096.803 | 5,4% / $38.206.735 |
| medio | 0,1% / $22.549.000 | 0,8% / $23.880.783 | 4,1% / $25.682.818 |
| agresivo | 9,1% / $13.405.100 | 9,1% / $9.503.620 | 11,6% / $9.932.187 |

(La mediana y la quiebra del agresivo difieren por la quiebra a $40.000 y los minijuegos
nuevos.) Como el handoff pide portar los números **tal cual**, no se cambió nada: la línea
base del test es la del código actual. Si se quiere volver al balance del documento, es una
decisión de diseño (por ejemplo, el conservador hoy llega al "millón" el 5,4% de las veces).
