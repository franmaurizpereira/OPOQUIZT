# Tasks 003 · Pool grande de preguntas para partidas únicas

**Estado:** completada (T1–T10)
**Plan:** `plan.md` (003-pool-preguntas-aleatorias)
**Máx. 10 tareas**, en orden. Cada una con sus RF y "Hecho cuando:".

---

## Tarea 1: Añadir modo `--pool` a `generate_quiz.py` (esqueleto y args) — ✅ HECHA

**Implementado (2026-10-21)**: `backend/config.py` exporta `QUIZ_POOL_PATH`; `backend/generate_quiz.py` incorpora `argparse` (`--pool N`), `main()` delega en `main_normal()` (intacto) o `main_pool(N)`, y `escribir_pool_json()` vuelca el pool de forma atómica (temporal + `replace`). El modo pool **no** toca `js/quiz.js`. Tests: 19/19 en verde.

- **Objetivo**: Que `python backend/generate_quiz.py --pool 1000` sea reconocido yprepare la generación masiva sin tocar `js/quiz.js`.
- **Ficheros afectados**: `backend/generate_quiz.py`, `backend/config.py` (añadir `QUIZ_POOL_PATH`).
- **Dependencias**: Ninguna (base actual).
- **RF**: RF1.
- **Hecho cuando**:
  - `python backend/generate_quiz.py --pool 1000 --help` muestra la opción.
  - Ejecutar sin `--pool` sigue generando `js/quiz.js` como hoy (compatibilidad).
  - `config.py` exporta `QUIZ_POOL_PATH = Path('js/quiz_pool.json')`.

---

## Tarea 2: Implementar selección equilibrada de chunks para el pool — ✅ HECHA

**Implementado (2026-10-21)**: nueva función `seleccionar_chunks_para_pool(fragmentos, num_preguntas, maximo_por_pdf=0.30, minimo_por_pdf=1, semilla=SEMILLA)` en `backend/generate_quiz.py`: reparto por rondas (round-robin) entre PDF, tope estricto del 30 % por documento, fragmentos eluidos a lo largo de cada PDF, orden barajado con semilla reproducible. `main_pool()` ya la usa. Tests unitarios en `backend/test_pool.py` (8/8 en verde). Verificado contra la BD real (2555 chunks, 9 PDF): 1000 seleccionados, reparto 8,5 %–11,6 % por PDF, sin fragmentos repetidos.

- **Objetivo**: Función `seleccionar_chunks_para_pool(num_preguntas, chunks_por_pdf)` que devuelve lista de chunks rotando por `ruta_pdf` (round-robin) y respeta límite 30 % por PDF.
- **Ficheros afectados**: `backend/generate_quiz.py`.
- **Dependencias**: Tarea 1.
- **RF**: RF1, RF3.
- **Hecho cuando**:
  - Test unitario: con 9 PDFs y 1000 preguntas, ningún PDF supera 300 chunks seleccionados.
  - La selección es determinista con semilla fija (reproducible).

---

## Tarea 3: Generar y validar preguntas en bucle, acumular en array — ✅ HECHA

**Implementado (2026-10-21)**: nueva función `generar_pregunta_desde_chunk(chunk, modelo, intentos=MAX_INTENTOS_POOL)` que genera **una** pregunta por fragmento con hasta 3 reintentos; `deduplicar_pool()`; `main_pool()` reescrito con bucle fragmento a fragmento, descarte de repetidas contra el pool acumulado, checkpoint cada 50 preguntas y aviso si el pool queda corto. **Caché propia del pool**: `logs/pool_cache.json` (`config.RUTA_CACHE_POOL`), separada de la del modo normal; `guardar_cache`/`cargar_cache` aceptan la ruta como parámetro. `escribir_pool_json()` publica solo los 4 campos de `quizData` (los de traza quedan en la caché) y escribe de forma atómica. Tests: `backend/test_pool.py` 24/24 en verde (incluye `test_reanuda_tras_un_corte`: corte simulado → relanzamiento → 40 preguntas sin repetir); Playwright 19/19.

- **Objetivo**: Bucle que para cada chunk seleccionado llama a Ollama, valida formato (4 opciones, correcta 0–3, explicación, solapamiento), deduplicaa contra pool acumulado y cache, y añade al array.
- **Ficheros afectados**: `backend/generate_quiz.py` (nuevas funciones: `generar_pregunta_desde_chunk`, `deduplicar_pool`, integración con `logs/preguntas_cache.json`).
- **Dependencias**: Tarea 2.
- **RF**: RF1, RF4.
- **Hecho cuando**:
  - Genera N preguntas válidas (test con N=10 mockando Ollama).
  - Preguntas inválidas se descartan y se reintenta (máx. 3 intentos por chunk).
  - Caché se lee al inicio y se fusiona al final (no sobrescribe).

---

## Tarea 4: Escritura atómica de `js/quiz_pool.json` y reanudación — ✅ HECHA (junto con la T3)

**Implementado (2026-10-21)**: `escribir_pool_json()` escribe de forma atómica (fichero temporal + `replace`) y publica solo los 4 campos del esquema `quizData`. La reanudación funciona: el checkpoint cada `CHECKPOINT_CADA` (50) preguntas escribe en `logs/pool_cache.json`, que se **fusiona** al arrancar y nunca se sobrescribe. Verificado con `test_reanuda_tras_un_corte` (corte simulado → relanzamiento → 40 preguntas sin repetir) y con `test_no_deja_fichero_temporal`.

- **Objetivo**: Al terminar (o por checkpoint cada 50 preguntas), escribe `js/quiz_pool.json` atómicamente (temp + replace). Si el script se relanza, detecta preguntas ya en caché y continúa.
- **Ficheros afectados**: `backend/generate_quiz.py`.
- **Dependencias**: Tarea 3.
- **RF**: RF1.
- **Hecho cuando**:
  - `js/quiz_pool.json` es array JSON válido, cada item pasa validador de esquema.
  - Cortar el script (Ctrl+C) y relanzar → continúa desde donde quedó, sin duplicados.
  - Checkpoint cada 50 preguntas configurável.

---

## Tarea 5: Generar el pool real (≥ 500 preguntas) offline — ✅ HECHA

**Hecha (2026-10-21)**: `js/quiz_pool.json` con **600 preguntas**. El generador
usa **OpenRouter** con el modelo gratuito `minimax/minimax-m3.1-flash:free` en
vez del modelo local de Ollama: con 27B en CPU cada pregunta tardaba ~29 s
(≈5 h para 600), y con el modelo remoto son ~6 s (≈35 min en total). Se añade
`OPENROUTER_API_KEY` como variable de entorno (nunca se guarda en el repo) y,
si no está, se sigue usando Ollama en local. Los lotes (4 preguntas por
llamada) se piden en paralelo (8 hilos) y se reintentan con espera creciente
si la API remota falla o expira.

Verificado con `backend/verificar_pool.py` (nuevo): 600 preguntas válidas, 9
documentos cubiertos con un reparto de 10,1 %–11,3 % cada uno (muy por debajo
del tope del 30 %), 0 enunciados repetidos, 0 preguntas con las mismas
opciones y la respuesta correcta repartida entre las cuatro opciones
(A 23,7 % / B 27,3 % / C 24,0 % / D 25,0 %).

- **Objetivo**: Ejecutar `python backend/generate_quiz.py --pool 1000` (o 500 si tiempo limitado) y obtener `js/quiz_pool.json` con ≥ 500 preguntas válidas, cubriendo los 9 PDFs.
- **Ficheros afectados**: `js/quiz_pool.json` (nuevo), `logs/preguntas_cache.json` (actualizado).
- **Dependencias**: Tareas 1–4.
- **RF**: RF1, RF3, RF4.
- **Hecho cuando**:
  - `js/quiz_pool.json` existe y `len(pool) ≥ 500`.
  - Script de verificación: ningún PDF > 30 % del pool.
  - 0 duplicados por enunciado ni por conjunto de opciones.
  - Tiempo total documentado en `MEMORY.md` (Coordinator).

---

## Tarea 6: Cargar pool en `app.js` con fallback a `quiz.js` — ✅ HECHA

**Implementado (2026-10-21)**: `js/app.js` incorpora `cargarPool()`, que hace
`fetch('js/quiz_pool.json')`, valida que sea una lista y que cada pregunta
cumpla el esquema (4 opciones distintas, `correcta` 0–3, explicación), y
exige al menos 30 preguntas válidas. Si algo falla, se avisa por consola y
se sigue con las 30 preguntas de `quiz.js`. La carga se hace **una sola vez**
(la promesa se guarda): antes se cargaba dos veces y el `.then()` inicial
reconstruía el quiz a mitad de partida, lo que rompía las pruebas. El banco
resultante se expone en `window.bancoPreguntas`.

- **Objetivo**: Función `cargarPoolOfallback()` que hace `fetch('js/quiz_pool.json')`, valida (array, length ≥ 30), y si falla usa `quizData` de `quiz.js` logueando aviso.
- **Ficheros afectados**: `js/app.js`.
- **Dependencias**: Tarea 5 (pool existe para probar).
- **RF**: RF2, RF5.
- **Hecho cuando**:
  - Con pool presente: `console.log` muestra "Pool cargado: N preguntas".
  - Sin pool (borrado temporal): `console.warn` muestra "Usando quiz.js fallback" y la partida funciona con 30 preguntas fijas.
  - No hay errores de red en consola.

---

## Tarea 7: Selección aleatoria de 30 preguntas y barajado de opciones — ✅ HECHA

**Implementado (2026-10-21)**: `elegirPartida()` baraja el banco entero y
toma 30 preguntas sin repetición; además descarta las que repiten alguna
opción ya usada en la partida (son las que delatan la respuesta) y, si no
llegara a 30, las completa con las que queden. `mezclarPartida()` trabaja
sobre **copias** (ni el pool ni `quizData` se modifican): baraja las
opciones de cada pregunta, vuelve a numerarlas A/B/C/D y recalcula el índice
`correcta`; después baraja también el orden de las preguntas.

- **Objetivo**: Función `construirPartidaDesdePool(pool, tamaño=30)` que hace `shuffle(pool).slice(0,30)` y para cada pregunta baraja sus 4 opciones recalculando `correcta`.
- **Ficheros afectados**: `js/app.js` (integrar en flujo de "EMPEZAR").
- **Dependencias**: Tarea 6.
- **RF**: RF2.
- **Hecho cuando**:
  - Al clickar EMPEZAR, la partida usa 30 preguntas del pool (no las 30 fijas de `quiz.js`).
  - En una partida, los 30 enunciados son distintos.
  - Las opciones de cada pregunta están en orden aleatorio y `correcta` apunta a la correcta.
  - Dos partidas consecutivas tienen preguntas distintas (salvo solape estadístico).

---

## Tarea 8: Tests Playwright del pool (4–5 tests nuevos) — ✅ HECHA

**Implementado (2026-10-21)**: nuevo fichero `tests/pool.spec.js` con 7
pruebas y el fixture `tests/fixtures/pool.js` (60 preguntas simuladas, con
enunciados y opciones únicos) que se sirve con `page.route`. Las pruebas
comprueban: el pool real existe y tiene ≥ 500 preguntas válidas, no tiene
preguntas repetidas, al empezar se usan las del pool, dos partidas
consecutivas sacan preguntas distintas, en una partida no se repite ninguna
pregunta ni ninguna opción, si el pool no se puede cargar se juega con
`quiz.js` y avisa, y el pool no impide jugar (la partida se completa y se
registra en el historial).

- **Objetivo**: Añadir tests que verifiquen pool, selección, variabilidad y fallback.
- **Ficheros afectados**: `tests/quiz.spec.js`, `tests/fixtures/quiz_pool_test.json` (fixture pequeño ~50 preguntas para tests rápidos).
- **Dependencias**: Tarea 7.
- **RF**: RF1, RF2, RF5.
- **Hecho cuando**:
  - `npx playwright test` pasa **24 tests** (19 actuales + 5 nuevos).
  - Tests nuevos:
    1. `quiz_pool.json` existe y tiene ≥ 500 preguntas válidas.
    2. Al iniciar partida, se usan preguntas del pool (no de `quizData`).
    3. Dos partidas consecutivas tienen conjuntos distintos.
    4. Fallback a `quiz.js` si pool no existe.
    5. (Opcional) Cobertura PDFs en fixture.

---

## Tarea 9: Actualizar `README.md` con instrucciones de generación del pool — ✅ HECHA

**Implementado (2026-10-21)**: sección "Cada partida es distinta" ampliada
con la generación del pool (comando, tiempo estimado, ejecución en segundo
plano, reanudación, publicación parcial y regeneración tras cambiar los
PDF), el árbol de ficheros actualizado y el bloque de pruebas con los
comandos del backend y del frontend.

- **Objetivo**: Documentar comando para generar pool, tiempo estimado, y que el quiz usa pool si existe.
- **Ficheros afectados**: `README.md`.
- **Dependencias**: Tarea 5.
- **RF**: RF5 (documentación).
- **Hecho cuando**:
  - `README.md` incluye sección "Pool de preguntas" con:
    - Comando: `python backend/generate_quiz.py --pool 1000`
    - Tiempo estimado: 3–6 horas.
    - Fallback automático a `quiz.js`.
    - Regenerar tras cambiar PDFs.

---

## Tarea 10: Validación final y cierre — ✅ HECHA

**Hecha (2026-10-21)**: `npx playwright test` → **26/26 passed** (19 del quiz
+ 7 del pool) y `backend/test_pool.py` → **24/24 OK**. Partida manual en el
navegador con el pool real: 30 preguntas del pool, progreso, marcado verde y
rojo, explicación, pantalla final e historial. El pool de 600 preguntas pasa
`backend/verificar_pool.py`. Sin pool, el fallback a `js/quiz.js` funciona
(prueba automática y comprobación manual).

- **Objetivo**: Ejecutar suite completa, verificar criterios de aceptación de la spec, y confirmar que no hay regresiones.
- **Ficheros afectados**: Ninguno (solo verificación).
- **Dependencias**: Tareas 1–9.
- **RF**: Todos (RF1–RF5).
- **Hecho cuando**:
  - `npx playwright test` → **24/24 passed** (o 19+5 nuevos).
  - Partida manual: 30 preguntas del pool, progreso, verde/rojo, explicación, pantalla final, reinicio.
  - Historial sigue funcionando (5 últimas, colores, registro).
  - Sin pool: fallback a `quiz.js` funciona.
  - `MEMORY.md` actualizado por Coordinator (no tocado por Implementer).