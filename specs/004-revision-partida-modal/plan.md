# Plan 004 · Revisión de la partida en ventana modal

**Spec:** `spec.md` (004-revision-partida-modal)
**Estado:** borrador

---

## 1. Punto de partida (estado real del proyecto)

- `js/app.js` (≈540 líneas) monta el quiz con `quizlib.min.js`:
  - `partida` → array con las 30 preguntas de la partida en curso (opciones ya
    re-numeradas A/B/C/D y `correcta` recalculada).
  - `respondida[]` → array de booleanos, uno por pregunta.
  - `comprobarYMarcas()` → ya calcula, para cada pregunta contestada, la
    opción **elegida** (`elegida`), la **acertada** (`acertada`) y pinta el
    marcado verde/rojo y la explicación.
  - `mostrarFinal()` → pinta la puntuación y llama a `registrarPartida()`.
- `backend/historial.py` guarda en `data/partidas.json` una lista de
  `{fecha, aciertos, fallos}` (máx. 100 partidas). La validación de la entrada
  es `_partida_valida()`.
- `backend/server.py` expone `GET /api/partidas` y `POST /api/partidas`
  (cuerpo `{aciertos, fallos}`).
- `css/style.css` no tiene nada de modal: hay que crear el bloque de estilos.
- `index.html` tiene las tres pantallas (`pantalla-inicio`, `pantalla-quiz`,
  `pantalla-final`) y carga `js/quizlib.min.js`, `js/quiz.js` y `js/app.js`.
- Pruebas: `npx playwright test` (26 en verde) y `backend/test_pool.py` (24).
- El pool de 600 preguntas está en `js/quiz_pool.json`; sus explicaciones
  mencionan a veces "el texto" o "el pasaje" (las escribió un modelo rápido).

## 2. Ficheros afectados

| Fichero | Qué cambia |
|---|---|
| `index.html` | Markup de la modal (`#revision-overlay`, `#revision-panel`, cabecera, filtros, lista, pie con el botón de cierre) y botón `#boton-revisar` en la pantalla final. |
| `css/style.css` | Bloque nuevo de estilos de la modal en estilo retro 80s (overlay, panel, etiquetas ACIERTO/FALLO/SIN CONTESTAR, filtros, scroll). |
| `js/app.js` | Recoger el detalle de la partida, pintar la revisión, filtros, cierre y foco; enviar el detalle al registrar la partida. |
| `backend/historial.py` | `guardar_partida(aciertos, fallos, detalle=None)`, validación del detalle y poda de los detalles antiguos. |
| `backend/server.py` | El `POST /api/partidas` acepta el campo opcional `detalle`. |
| `backend/config.py` | `OPENROUTER_MODEL` (modelo remoto por defecto, configurable). |
| `backend/generate_quiz.py` | Usar `config.OPENROUTER_MODEL`; nuevo modo `--mejorar-explicaciones`. |
| `backend/test_pool.py` | Tests del detalle del historial y de la validación de explicaciones. |
| `tests/revision.spec.js` | Pruebas Playwright de la modal (nuevo). |
| `tests/quiz.spec.js` | Ajustes mínimos si el nuevo botón altera algún selector. |
| `js/quiz_pool.json` | Se regenera si se mejora el texto de las explicaciones (tarea opcional). |
| `README.md` | Documentar la revisión y el modo de improving explicaciones. |

## 3. Funciones puras (con "hoy" como parámetro)

### 3.1 `js/app.js`

```js
/**
 * Construye el detalle de la partida a partir de lo que hay en pantalla.
 * Devuelve un array con una entrada por pregunta:
 * {pregunta, opciones, correcta, elegida, acertada, contestada, explicacion}
 */
function recogerDetalle()

/** Devuelve el detalle de la última partida (o [] si no hay). */
function ultimoDetalle()

/** Pinta la revisión de un detalle y muestra la modal. */
function abrirRevision(detalle)

/** Cierra la modal y devuelve el foco al botón de origen. */
function cerrarRevision()

/** Muestra en la lista de la modal solo las preguntas del filtro dado. */
function filtrarRevision(tipo)   // 'todas' | 'acertadas' | 'falladas' | 'sin-contestar'

/** Resumen de la revisión: {acertadas, falladas, sinContestar, total}. */
function resumirDetalle(detalle)
```

- `recogerDetalle()` **no** toca el DOM: lee `partida` y `respondida`, y la
  opción elegida se toma del `input:checked` de cada bloque. Es pura respecto
  al DOM (solo lectura).
- `resumirDetalle()` y `filtrarRevision()` son puras: reciben el detalle y
  devuelven datos, sin modificar nada.

### 3.2 `backend/historial.py`

```python
"""Valida el detalle de una partida. Devuelve el detalle limpio o None."""
def validar_detalle(detalle)

"""Registra una partida con su detalle (opcional) y devuelve el historial."""
def guardar_partida(aciertos, fallos, detalle=None)
```

- `validar_detalle()` acepta una lista de 30 elementos (o la que sea) con las
  claves `pregunta`, `opciones` (4 textos), `correcta` (0-3), `elegida`
  (-1 si no se contestó), `acertada` (booleano) y `explicacion`. Descarta
  entradas mal formadas y normaliza los tipos.
- `guardar_partida()` guarda el detalle solo de las **20 partidas más
  recientes**; de las anteriores, lo poda (conserva fecha, aciertos y fallos).
  Así el fichero no crece sin límite (decisión D3 de la spec).

### 3.3 `backend/generate_quiz.py`

```python
"""Reescribe las explicaciones del pool con un modelo remoto."""
def mejorar_explicacion(modelo, pregunta, opciones, correcta, explicacion_actual)

"""Recorre el pool y reescribe sus explicaciones (con checkpoint)."""
def mejorar_explicaciones_del_pool(cantidad=None)
```

- El modelo se toma de `config.OPENROUTER_MODEL` (por defecto
  `minimax/minimax-m3.1-flash:free`, el mismo que generó el pool), con
  `OPENROUTER_API_KEY` en el entorno. Es un modelo rápido y gratuito: el
  problema que se arregla (quitar las referencias a "el texto") no necesita
  un modelo grande.
- La reescritura solo toca `explicacion`: el enunciado, las opciones y la
  posición de la correcta no se modifican.
- Validación de la explicación reescrita: en español, entre 40 y 600
  caracteres, sin referencias a "el texto"/"el contexto"/"el pasaje"/"el
  fragmento", sin repetir el enunciado. Si no pasa, se conserva la anterior.

## 4. Decisiones (con la alternativa descartada)

| # | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| P1 | La revisión es una **lista con scroll** de las 30 preguntas. | Modal de una en una, como el quiz. | Comparar de un vistazo qué se falló es el objetivo; además cabe en el móvil. |
| P2 | El detalle se guarda en el **historial en disco**. | Solo en memoria del navegador. | El repaso se hace cuando toca estudiar, no justo al terminar. |
| P3 | Se podan los detalles antiguos (se quedan 20). | Guardarlos todos (100 × 15 KB). | El fichero del historial es local y no debe crecer sin control. |
| P4 | La modal se hace con **HTML/CSS/JS propios**, sin librería. | Usar `<dialog>` nativo. | `<dialog>` no está en el Chromium del entorno de pruebas de forma fiable y el estilo retro hay que hacerlo igual. |
| P5 | El foco va a la modal al abrir y vuelve al botón al cerrar. | Solo `ESCAPE`. | Accesibilidad de teclado (tecla `Tab` atrapada dentro de la modal). |
| P6 | Las explicaciones se reescriben con un **script aparte** (`--mejorar-explicaciones`), no al generar el pool. | Reescribir dentro del generador del pool. | Son dos cosas distintas: generar preguntas nuevas y pulir el texto de las que ya hay. |
| P7 | El modelo remoto es configurable (`OPENROUTER_MODEL`) y por defecto es el **rápido y gratuito** (`minimax/minimax-m3.1-flash:free`). | Fijar `deepseek-v4-pro` en el código. | Quitar referencias a "el texto" no necesita un modelo grande: el rápido y gratis basta y no cuesta nada. El nombre queda configurable por si algún día se quiere otro. |
| P8 | Los filtros se aplican **en el navegador**, sin volver a pedir datos al servidor. | Filtrar en el servidor. | El detalle ya está en la página; filtrar en local es instantáneo. |

## 5. Estrategia de tests

**Playwright (`tests/revision.spec.js`, nuevo):**

1. Al terminar la partida, la pantalla final muestra el botón de revisión.
2. La modal se abre y lista las 30 preguntas en el orden de la partida.
3. Cada pregunta muestra enunciado, opciones, elegida, correcta y explicación.
4. La correcta sale en verde y la elegida incorrecta en rojo (clases
   `quizlib-correct` / `quizlib-incorrect`).
5. Una pregunta sin contestar sale sin color y sin explicación.
6. El resumen muestra aciertos, fallos y sin contestar.
7. Los filtros funcionan y avisan cuando no hay resultados.
8. La modal se cierra con el botón, con `ESCAPE` y con un clic fuera; el
   juego sigue utilizable.
9. Desde el historial de la pantalla de inicio se abre la revisión de una
   partida con detalle.
10. Una entrada de historial sin detalle no rompe el historial.

**Unitarios (`backend/test_pool.py`):**

- `validar_detalle()` acepta un detalle correcto, rechaza uno mal formado y
  normaliza tipos.
- `guardar_partida()` guarda el detalle, y `leer_partidas()` lo devuelve; las
  partidas antiguas se quedan sin detalle (poda a 20).

**Regresión:** `npx playwright test` debe seguir en verde (26 actuales + los
nuevos) y `backend/test_pool.py` en verde.

## 6. Requisitos que cubre cada parte

| Parte | RF |
|---|---|
| Botón en la pantalla final y apertura de la modal | RF1 |
| Contenido de cada pregunta y marcado | RF2 |
| Filtros, cierre y foco | RF3 |
| Detalle en el historial y revisión desde el inicio | RF4 |
| Estilos retro 80s, español y sin red | RF5 |
| `OPENROUTER_MODEL` y reescritura de explicaciones | RF6 |

## 7. Riesgos

- **El historial crece**: mitigado podando a 20 partidas con detalle (P3).
- **El foco atrapado en la modal** en navegadores sin `:focus-visible`:
  se prueba con `Tab` en Playwright.
- **Explicaciones reescritas que no pasan la validación**: se conserva la
  anterior (RF6) y el pool nunca queda peor que antes.
- **Coste del modelo remoto**: con el modelo rápido y gratuito no hay
  coste; la tarea es opcional y se puede parar y reanudar (mismo mecanismo de
  checkpoint que el pool).
- **El `POST /api/partidas` grows**: el servidor ya acepta cuerpos JSON
  arbitrarios; hay que poner un límite de tamaño razonable al leer el cuerpo.
