# Spec 002 · Partidas sin repeticiones, con orden variable y con historial fiable

**Estado:** implementado (17/17 tests en verde)
**Fecha:** 2026-10-20
**Solicitud original:** "El número de fallos debe estar cambiado con el número de aciertos en el listado, ya que he acertado el 80 % de las preguntas y indica que he acertado solo 9 aciertos. Mientras juegas las preguntas se repiten, NO PUEDE repetirse preguntas en la partida. Cuando juegas más de una partida se comprueba que las preguntas no son aleatorias, no cambian entre partidas siendo las mismas y en el mismo orden. Las preguntas cuando empiece una partida nueva tienen que ser distintas a la anterior."

---

## 1. Problema

Se han detectado tres defectos independientes:

1. **El historial no refleja las partidas reales.** El banco de pruebas
   automáticas escribe en el mismo fichero que usa la aplicación, así que
   una partida jugada por la persona aparece sustituida por la partida
   artificial de las pruebas (siempre la primera opción → 9 aciertos). De ahí
   que un 80 % de aciertos se visualice como 9.
2. **Hay preguntas repetidas dentro de la misma partida.** El banco de
   preguntas contiene tres versiones de la misma pregunta (art. 37.2 del
   TREBEP: la 6, la 16 y la 19). Al recorrer la partida se ve la misma
   pregunta tres veces con las opciones barajadas: parece un fallo.
3. **Todas las partidas son idénticas.** El orden de las preguntas y el orden
   de las opciones son siempre los mismos, así que una segunda partida es
   una repetición exacta de la primera.

## 2. Objetivo

Que cada partida sea una experiencia nueva: sin preguntas repetidas, con
orden y posiciones de respuesta variables, y con un historial que refleje
fielmente lo que el jugador ha jugado.

## 3. Alcance

**Incluido**
- Barajado del orden de las preguntas y de las opciones al empezar cada
  partida, recalculando la posición de la respuesta correcta.
- Eliminación de las preguntas duplicadas del banco actual.
- Prevention de duplicados en las generaciones futuras.
- Aislamiento del fichero de historial que usan las pruebas automáticas.
- Historial intacto y fidedigno de las partidas reales.

**Excluido**
- Ampliar el banco de preguntas (hoy son 30, el tamaño de una partida).
- Perfiles de jugador, sincronización o estadísticas.

## 4. Requisitos funcionales (EARS)

### RF1 · Ninguna pregunta se repite dentro de una partida
- EL SISTEMA NO DEBE presentar dos veces la misma pregunta en una partida.
- DOS preguntas CUYO CONJUNTO DE OPCIONES SEA EL MISMO (o cuyo enunciado sea
  casi idéntico) SE CONSIDERARÁN LA MISMA y no podrán coincidir en el banco.
- SI al generar el banco se detectan preguntas solapadas, EL SISTEMA DEBE
  SUSTITUIRLAS por otras y no publicarlas.

### RF2 · Cada partida tiene un orden propio
- AL EMPEZAR CADA PARTIDA, EL SISTEMA DEBE MEZCLAR el orden de las preguntas.
- AL EMPEZAR CADA PARTIDA, EL SISTEMA DEBE MEZCLAR el orden de las opciones de
  CADA pregunta, de modo que la respuesta correcta no ocupe siempre la misma
  posición.
- LA POSICIÓN DE LA RESPUESTA CORRECTA DEBE RECALCULARSE tras cada mezcla.
- SI DOS PARTIDAS CONSECUTIVAS COINCIDEN EN ORDEN (posibilidad remota), EL
  SISTEMA DEBE REGENERAR LA MEZCLA.

### RF3 · El historial refleja las partidas reales
- LAS PRUEBAS AUTOMÁTICAS NO DEBEN ESCRIBIR EN EL HISTORIAL DE LA PERSONA.
- CADA PARTIDA TERMINADA DEBE REGISTRARSE EXACTAMENTE UNA VEZ con sus
  aciertos y sus fallos, y la suma debe ser el total de preguntas.
- EL HISTORIAL NO DEBE MOSTRAR PARTIDAS QUE NO SE HAYAN JUGADO.

### RF4 · El banco de preguntas no contiene solapamientos
- EL GENERADOR DEBE DESCARTAR una pregunta cuyas opciones se solapen
  claramente con las de otra ya generada.
- EL BANCO PUBLICADO NO DEBE CONTENER dos preguntas con el mismo conjunto de
  opciones.

## 5. Casos límite

| Caso | Comportamiento esperado |
|---|---|
| Dos partidas seguidas | Cambian el orden de las preguntas y el de las opciones. |
| Una partida nueva tras reiniciar | Vuelve a mezclar: no se repite el orden anterior. |
| Se baraja una pregunta | La explicación sigue siendo la misma y la correcta se marca bien. |
| La lista de opciones barajada | La opción correcta cambia de letra (A/B/C/D) según la mezcla. |
| Las pruebas automáticas | Escriben en un fichero de historial aparte; el del usuario no se toca. |
| Banco con 30 preguntas y partidas de 30 | El conjunto es el mismo, pero el orden y las posiciones cambian en cada partida. |

## 6. Criterios de aceptación (verificables)

1. En una partida completa, los 30 enunciados mostrados son distintos entre sí.
2. En una partida completa, ninguna opción se repite entre preguntas
   distintas.
3. El banco publicado no tiene dos preguntas con el mismo conjunto de opciones.
4. Dos partidas consecutivas muestran las preguntas en distinto orden.
5. En dos partidas consecutivas, alguna pregunta cambia la posición de su
   respuesta correcta.
6. Tras una partida, el historial refleja la puntuación real (por ejemplo, 24
   aciertos y 6 fallos si se han acertado 24).
7. Al ejecutar la suite de pruebas, el historial del usuario no cambia.
8. La suite de pruebas automáticas sigue en verde.
9. La interfaz sigue en español y con el estilo retro de los años 80.

## 7. Decisiones

| # | Decisión | Consecuencia |
|---|---|---|
| D1 | El banco sigue siendo de 30 preguntas; lo que varía es el **orden** y la **posición de las respuestas**. | Para tener preguntas realmente distintas entre partidas habría que ampliar el banco (tarea futura: generar 60-90). |
| D2 | Las pruebas usan un **fichero de historial propio**, no el del usuario. | El historial real queda limpio. |
| D3 | La reparación del banco actual se hace **sustituyendo solo las preguntas solapadas**, no regenerando las 30. | Se mantiene el trabajo ya hecho y solo se incurre en el coste de unas pocas llamadas al modelo. |
