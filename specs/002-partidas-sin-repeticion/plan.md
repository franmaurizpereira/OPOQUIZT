# Plan 002 · Partidas sin repeticiones, con orden variable y con historial fiable

**Estado:** implementado (17/17 tests en verde)
**Spec:** `spec.md` (002-partidas-sin-repeticion)

---

## 1. Causas y soluciones

| Defecto | Causa | Solución |
|---|---|---|
| El historial muestra 9 aciertos | Las pruebas automáticas escriben en `data/partidas.json`, el mismo fichero que usa la app | Rutas del historial por variable de entorno: `OPOQUIZ_HISTORIAL`. Las pruebas usan `data/partidas-test.json` |
| Preguntas repetidas en la partida | El banco tiene 3 versiones de la misma pregunta (art. 37.2 TREBEP: la 6, la 16 y la 19). `deduplicar()` solo comparaba el **enunciado** | `deduplicar()` compara también el **conjunto de opciones**; y se reparan las preguntas ya publicadas |
| Partidas siempre iguales | `js/quiz.js` es un array estático: mismo orden de preguntas y de opciones | Al construir la partida se mezclan preguntas y opciones, y se recalcula `correcta` |

## 2. Decisiones técnicas

### D1 · Mezcla en el cliente, sobre una copia
- `quizData` (el fichero generado) **no se toca**: es la fuente de verdad.
- Al construir la partida se crea una **copia mezclada** (`partida`) que es la
  que se pinta en el DOM y la que se le pasa a `quizlib`.
- Motivo: el barajado en el servidor obligaría a reescribir `js/quiz.js` en
  cada partida; en el cliente es inmediato y no depende del LLM.

### D2 · La mezcla se recalcula al reiniciar
- `construirPreguntas()` se llama al arrancar y en cada "Volver a empezar":
  ahí se hace la mezcla → cada partida tiene orden propio.
- Se mezclan **dos cosas**: el orden de las preguntas y el de las opciones de
  cada una. Al mezclar las opciones se recalcula la posición de la correcta.

### D3 · Historial aislado por entorno
- `backend/historial.py` toma la ruta de `OPOQUIZ_HISTORIAL` (si existe) o de
  `data/partidas.json`.
- `playwright.config.js` arranca el servidor con `OPOQUIZ_HISTORIAL=data/partidas-test.json`.
- Las pruebas escriben en ese fichero y **no tocan el del usuario**.

### D4 · Deduplicación por enunciado **y** por opciones
- `deduplicar()` en `backend/generate_quiz.py` pasa a comparar también el
  conjunto de opciones (Jaccard de los textos normalizados, umbral 0.6).
- Motivo: dos preguntas con el mismo enunciado redactado de otra forma se
  escapaban del filtro.

### D5 · Reparación del banco publicado
- Script nuevo `backend/reparar_quiz.py`:
  1. Lee `js/quiz.js`.
  2. Detecta los grupos de preguntas solapadas (mismo conjunto de opciones).
  3. Conserva la primera de cada grupo y sustituye las demás por preguntas
     nuevas pedidas al LLM desde fragmentos de la BD que no estén ya usados.
  4. Valida cada candidata igual que el generador y además comprueba que no
     se solape con ninguna pregunta que se queda.
  5. Reescribe `js/quiz.js` con el formato del proyecto.
- Motivo: solo hay que pagar un par de llamadas al modelo en vez de regenerar
  las 30 preguntas (≈20 min).

## 3. Ficheros afectados

| Fichero | Qué hace |
|---|---|
| `js/app.js` | Mezcla de preguntas y opciones por partida; se trabaja con una copia (`partida`) en lugar de `quizData`. |
| `backend/historial.py` | Ruta del historial por variable de entorno `OPOQUIZ_HISTORIAL`. |
| `backend/generate_quiz.py` | `deduplicar()` compara también las opciones. |
| `backend/reparar_quiz.py` (nuevo) | Detecta y repara preguntas solapadas en `js/quiz.js`. |
| `playwright.config.js` | Las pruebas usan su propio fichero de historial. |
| `tests/quiz.spec.js` | Pruebas nuevas + aislamiento del historial del usuario. |
| `js/quiz.js` | Banco reparado (sin preguntas solapadas). |
| `README.md`, `MEMORY.md` | Documentación. |

## 4. Estrategia de tests

Runner: **`npx playwright test`**.

1. **Sin repeticiones**: se recorren las 30 preguntas y se comprueba que los
   enunciados son distintos y que ninguna opción se repite entre preguntas.
2. **Orden variable**: se juegan dos partidas seguidas y se comprueba que el
   orden de los enunciados es distinto.
3. **Posición variable**: entre dos partidas, alguna pregunta cambia la letra
   de su respuesta correcta.
4. **Historial real intacto**: se anota el contenido del historial del
   usuario antes y después de la suite y se comprueba que no ha cambiado.
5. **Aciertos correctos**: al terminar una partida con un número conocido de
   aciertos, el historial registra ese número y el resto como fallos.

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Mezclar y equivocarse al recalcular `correcta` | Se recalcula por **texto** de la opción correcta, no por índice; test que comprueba la letra correcta tras mezclar |
| Que la reparación tarde mucho | Solo se generan las preguntas que faltan (2 en este caso) |
| Que el LLM devuelva una pregunta que se solape con otra | Se valida con el mismo filtro de solapamiento que el generador, contra todas las preguntas conservadas |
| Que las pruebas booleanas mezclen el historial real | Fichero separado por variable de entorno + test que lo comprueba |
