# Tasks 004 · Revisión de la partida en ventana modal

**Estado:** completada (T1–T7)
**Plan:** `plan.md` (004-revision-partida-modal)
**Máx. 10 tareas**, en orden. Cada una con sus RF y "Hecho cuando:".

---

## Tarea 1: Recoger el detalle de la partida en el navegador — ✅ HECHA

**Implementado (2026-10-22)**: en `js/app.js` se apuntan `elegidas[i]` y
`acertadas[i]` en el evento `change` (al contestar, no al terminar), y
`recogerDetalle()` arma el detalle con enunciado, opciones, correcta,
elegida, acertada, contestada y explicación. `resumirDetalle()` devuelve
`{acertadas, falladas, sinContestar, total}`. Ninguna función toca el DOM.


- **Objetivo**: que la aplicación sepa, al terminar, qué se eligió en cada
  pregunta y si se acertó, sin tocar aún la interfaz.
- **Ficheros afectados**: `js/app.js`.
- **Dependencias**: ninguna.
- **RF**: RF2 (datos), RF4 (preparación del guardado).
- **Criterios de aceptación**:
  - Existe `recogerDetalle()` que devuelve una entrada por pregunta de la
    partida con `pregunta`, `opciones` (4), `correcta`, `elegida` (-1 si no
    se contestó), `acertada`, `contestada` y `explicacion`.
  - El detalle se recoge **después** de que la pregunta esté comprobada, de
    modo que la opción elegida es la marcada.
  - `resumirDetalle(detalle)` devuelve `{acertadas, falladas, sinContestar, total}`.
  - Ninguna función modifica el DOM.
- **Riesgos**: leer el `input:checked` antes de la comprobación daría
  respuestas vacías; hay que recoger el detalle en el momento correcto.
- **Hecho cuando**: las funciones existen, devuelven los datos esperados y la
  suite sigue en verde.

---

## Tarea 2: Modal de revisión (markup, estilos y apertura) — ✅ HECHA

**Implementado (2026-10-22)**: `index.html` trae el markup de la modal
(`#revision-overlay`, `#revision-panel`, cabecera con el resumen, fila de
filtros, lista y pie) y el botón `#boton-revisar` en la pantalla final.
`css/style.css` tiene el bloque de estilos propio (overlay, panel con bisel
neón, etiquetas ACIERTO/FALLO/SIN CONTESTAR, opciones con la correcta en
verde y la elegida en rojo). En `js/app.js`: `pintarPreguntaRevision()`,
`pintarResumen()`, `pintarRevision()` y `abrirRevision()`.


- **Objetivo**: que exista la ventana modal con la revisión de la partida.
- **Ficheros afectados**: `index.html`, `css/style.css`, `js/app.js`.
- **Dependencias**: Tarea 1.
- **RF**: RF1, RF2, RF5.
- **Criterios de aceptación**:
  - La pantalla final tiene un botón de revisión que abre la modal.
  - La modal se abre **encima** de la pantalla final (overlay a pantalla
    completa) y el contenido se puede desplazar con la rueda.
  - Lista las 30 preguntas en el orden en que se mostraron, con el número, el
    enunciado, las cuatro opciones, la elegida, la correcta, el resultado y la
    explicación.
  - La opción correcta en verde y la elegida incorrecta en rojo, con las mismas
    clases que usa el quiz.
  - Las preguntas sin contestar, sin color y sin explicación.
  - Resumen arriba con aciertos, fallos y sin contestar.
  - Todos los textos en español y estilo retro 80s (fondo oscuro, neones,
    monoespaciada, bordes pixelados).
- **Riesgos**: estilos que tapen la pantalla final o que no se vean en el
  Chromium de las pruebas.
- **Hecho cuando**: la modal se abre con la partida real y se ve correcta en
  el navegador.

---

## Tarea 3: Filtros, cierre y foco de la modal — ✅ HECHA

**Implementado (2026-10-22)**: `filtrarRevision()` aplica el filtro en el
navegador (todo local, sin pedir nada al servidor) y marca el botón activo;
si no hay resultados se muestra el aviso "NO HAY PREGUNTAS CON ESE FILTRO".
La modal se cierra con el botón de la cabecera, con el del pie, con `ESCAPE`
y con un clic fuera del panel, y el foco vuelve al botón que la abrió. La
modal se cierra también al pulsar INICIO o VOLVER A EMPEZAR.


- **Objetivo**: que la revisión se pueda filtrar y cerrar con comodidad.
- **Ficheros afectados**: `js/app.js`, `css/style.css`.
- **Dependencias**: Tarea 2.
- **RF**: RF3.
- **Criterios de aceptación**:
  - Cuatro filtros: todas, acertadas, falladas y sin contestar; el filtro
    activo se ve marcado.
  - Con un filtro sin resultados se muestra un mensaje, no una lista vacía.
  - La modal se cierra con el botón, con `ESCAPE` y con un clic fuera del
    panel, y el juego sigue utilizable.
  - Al abrir, el foco entra en la modal; al cerrar, vuelve al botón que la
    abrió.
  - Nunca hay dos modales a la vez.
- **Riesgos**: el clic fuera dispara al pulsar dentro; hay que comprobar que
  el clic está realmente fuera del panel.
- **Hecho cuando**: los filtros y los tres cierres funcionan y están probados.

---

## Tarea 4: Guardar el detalle en el historial y revisarlo desde el inicio — ✅ HECHA

**Implementado (2026-10-22)**: `backend/historial.py` incorpora
`validar_detalle()` (acepta el detalle correcto, rechaza el mal formado y
normaliza los tipos) y `guardar_partida(aciertos, fallos, detalle=None)`, que
poda el detalle de las partidas que no están entre las 20 más recientes
(`MAXIMO_CON_DETALLE`) sin perderlas. `backend/server.py` acepta el campo
`detalle` en el `POST /api/partidas`. En el frontend, el registro envía el
detalle y el historial muestra un botón **REVISAR** en las partidas que lo
tienen; las que no (jugadas antes de esta versión) se muestran igual, sin
botón.


- **Objetivo**: que la partida guardada lleve su detalle y que se pueda repasar
  desde la pantalla de inicio.
- **Ficheros afectados**: `backend/historial.py`, `backend/server.py`,
  `js/app.js`, `index.html`.
- **Dependencias**: Tareas 1 y 2.
- **RF**: RF4.
- **Criterios de aceptación**:
  - `validar_detalle()` acepta un detalle correcto y rechaza uno mal formado.
  - `guardar_partida(aciertos, fallos, detalle)` guarda el detalle; el
    `POST /api/partidas` lo acepta.
  - `leer_partidas()` devuelve el detalle de las partidas que lo tienen.
  - Solo las 20 partidas más recientes conservan el detalle; de las anteriores
    se poda, pero conservan fecha, aciertos y fallos.
  - Una partida sin detalle (jugada antes de esta versión) no impide ver el
    historial ni jugar, y no ofrece botón de revisar.
  - Desde la pantalla de inicio se abre la revisión de una partida con
    detalle.
- **Riesgos**: partidas antiguas sin el campo `detalle` (hay que leerlas sin
  romper); el fichero del historial creciendo (se poda).
- **Hecho cuando**: se juega, se recargue la página y la partida sigue
  siendo revisable.

---

## Tarea 5: Pruebas automáticas de la revisión — ✅ HECHA

**Implementado (2026-10-22)**: `tests/revision.spec.js` (nuevo) con 9 pruebas:
apertura desde la pantalla final, contenido y explicación de cada pregunta,
marcado verde/rojo, pregunta sin contestar sin color ni explicación, filtros,
filtro sin resultados, los tres cierres, revisión desde el historial y
partida antigua sin detalle. `backend/test_pool.py` incorpora 5 pruebas del
detalle (validación, guardado, lectura y poda) y 4 de la validación de las
explicaciones reescritas. Total: **35 pruebas de Playwright** y **35 unitarias**
en verde.


- **Objetivo**: que la funcionalidad de la revisión no se rompa sin que nadie
  se entere.
- **Ficheros afectados**: `tests/revision.spec.js` (nuevo), `backend/test_pool.py`.
- **Dependencias**: Tareas 2, 3 y 4.
- **RF**: RF1, RF2, RF3, RF4.
- **Criterios de aceptación**:
  - Al menos 8 pruebas de Playwright nuevas cubren: apertura, contenido,
    marcado verde/rojo, pregunta sin contestar, resumen, filtros, los tres
    cierres y la revisión desde el historial.
  - Pruebas unitarias de `validar_detalle()` y de la poda del historial.
  - `npx playwright test` en verde y `backend/test_pool.py` en verde.
  - Las pruebas no tocan el historial real de la persona.
- **Riesgos**: pruebas que dependan del orden aleatorio de las preguntas.
- **Hecho cuando**: la suite completa pasa.

---

## Tarea 6: Modelo remoto configurable y reescritura de las explicaciones — ✅ HECHA

**Implementado (2026-10-22)**: `config.OPENROUTER_MODEL` (por defecto
`minimax/minimax-m3.1-flash:free`, el mismo modelo rápido y gratuito del
pool) y `generate_quiz.py` lo usa. Nuevo modo `--mejorar-explicaciones`:
recorre `js/quiz_pool.json`, detecta las explicaciones que hablan de "el
texto"/"el pasaje"/"el contexto" (65 de 600) y las reescribe para que se
entiendan solas, sin tocar el enunciado, las opciones ni la posición de la
correcta. Validación: en español, entre 40 y 600 caracteres, sin referencias
al documento y sin repetir el enunciado; si no pasa, se conserva la anterior.
Se puede parar y reanudar (`logs/explicaciones_cache.json`).

**Resultado**: 64 de las 65 explicaciones reescritas (la que falta, en el
segundo intento). En el pool publicado **no queda ninguna explicación** que
diga "el texto", "el pasaje" o "el contexto" (0 de 600), y el pool sigue
cumpliendo todos los requisitos de `backend/verificar_pool.py`.


- **Objetivo**: poder pulir el texto de las explicaciones del pool con un
  modelo mejor, y que el modelo remoto sea configurable.
- **Ficheros afectados**: `backend/config.py`, `backend/generate_quiz.py`.
- **Dependencias**: Tareas 1 y 2 (la revisión muestra las explicaciones).
- **RF**: RF6.
- **Criterios de aceptación**:
  - `config.OPENROUTER_MODEL` existe y por defecto vale
    `minimax/minimax-m3.1-flash:free` (el modelo rápido y gratuito);
    `generate_quiz.py` lo usa en lugar del nombre fijo.
  - Existe el modo `--mejorar-explicaciones`: recorre `js/quiz_pool.json` y
    reescribe **solo** el campo `explicacion`.
  - La validación de la explicación reescrita: en español, entre 40 y 600
    caracteres, sin "el texto"/"el contexto"/"el pasaje"/"el fragmento" y sin
    repetir el enunciado. Si no pasa, se conserva la anterior.
  - Se puede parar y reanudar (checkpoint) sin perder lo ya reescrito.
  - Las preguntas del pool que ya estaban bien no empeoran.
- **Riesgos**: que el modelo rápido no respete las reglas y las explicaciones
  no mejoren (se conservan las anteriores, así que el pool nunca empeora).
- **Hecho cuando**: el modo funciona sobre el pool real y el pool sigue
  siendo válido para el juego.

---

## Tarea 7: Documentación y validación final — ✅ HECHA

**Hecha (2026-10-22)**: `README.md` explica la revisión de la partida y el
modo `--mejorar-explicaciones`; `MEMORY.md` recoge las decisiones a recordar
(el detalle en el historial, la poda a 20 partidas, la opción elegida se
guarda al contestar, sin color en las preguntas sin contestar, el detector de
"el texto" que ignora "el Texto Refundido"). Validación final:
`npx playwright test` → **35/35**, `backend/test_pool.py` → **35/35**,
`backend/verificar_pool.py` → el pool cumple todos los requisitos, y partida
manual en el navegador con la modal abierta (30 preguntas, resumen, marcado
verde/rojo y explicaciones reescritas).


- **Objetivo**: dejar la functionality documentada y verificada.
- **Ficheros afectados**: `README.md`, `MEMORY.md`, `specs/004-revision-partida-modal/tasks.md`.
- **Dependencias**: Tareas 1–6.
- **RF**: todos.
- **Criterios de aceptación**:
  - `README.md` explica la revisión de la partida y el modo de mejorar
    explicaciones.
  - `MEMORY.md` recoge las decisiones que hay que recordar.
  - `npx playwright test` y `backend/test_pool.py` en verde.
  - `js/quiz_pool.json` sigue siendo válido (`backend/verificar_pool.py`).
  - Partida manual: terminar, abrir la revisión, filtrar, cerrar, volver a
    abrir, revisar una partida anterior desde el inicio.
- **Riesgos**: ninguno relevante.
- **Hecho cuando**: todo lo anterior está comprobado y anotado.
