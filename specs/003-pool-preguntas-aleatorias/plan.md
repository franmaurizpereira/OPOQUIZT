# Plan 003 · Pool grande de preguntas para partidas únicas

**Estado:** borrador
**Spec:** `spec.md` (003-pool-preguntas-aleatorias)
**Fecha:** 2026-10-21

---

## 1. Idea rectora

Generar **una sola vez offline** un pool de 500–1000 preguntas válidas y guardarlo en `js/quiz_pool.json`. El frontend (`app.js`) al iniciar cada partida selecciona 30 preguntas aleatorias sin repetición, baraja su orden y el de sus opciones (comportamiento ya implementado en spec 002). El quiz sigue funcionando 100 % offline, sin BD ni Ollama en runtime.

```
backend/generate_quiz.py (modo pool) ──lee chunks BD──▶ Ollama (qwen3.8:27b)
        │                                              │
        │  valida + deduplica + cache incremental      │
        ▼                                              ▼
logs/preguntas_cache.json  ◀────── fusión ───────────▶ js/quiz_pool.json (≥500)
        │
        ▼ (fallback si no hay pool)
js/quiz.js (30 preguntas fijas, ya existe)
```

---

## 2. Decisiones técnicas

### D1 · Archivo `js/quiz_pool.json` servido estáticamente
- **Formato**: array de objetos con el **mismo esquema** que `quizData` de `quiz.js`.
- **Tamaño estimado**: 1000 preguntas × ~1,5 KB ≈ 1,5 MB (gzip ~300 KB). Aceptable.
- **Fallback**: si `quiz_pool.json` no existe o tiene < 30 preguntas, se usa `quizData` de `quiz.js`.

### D2 · Modo "pool" en `generate_quiz.py`
- Nuevo argumento `--pool N` (o `--num-pool`) que genera `N` preguntas y escribe `js/quiz_pool.json`.
- Reutiliza toda la lógica existente: búsqueda de chunks, prompt al modelo, validación, deduplicación, caché.
- Diferencia con modo normal: **no sobrescribe `js/quiz.js`**, acumula en array y escribe al final.
- Semilla reproducible para selección de chunks (evita sesgos).

### D3 · Caché incremental en `logs/preguntas_cache.json` (ya existe, se reusa)
- Clave: hash del chunk origen + hash del prompt → evita regenerar lo mismo.
- Se **fusiona** con lo anterior (no sobrescribe), permitiendo reanudar tras cortes.
- Estructura: `{"preguntas": [...], "chunks_usados": [...], "stats": {...}}`.

### D4 · Selección en `app.js` (cambio mínimo)
- Al clickar "EMPEZAR":
  1. `fetch('js/quiz_pool.json')` → si OK y length ≥ 30 → `pool = data`
  2. Sino → `pool = quizData` (fallback al array fijo de 30)
  3. `partida = shuffle(pool).slice(0, 30)`
  4. Para cada pregunta: `shuffle(opciones)` recalculando `correcta`
  5. `new Quiz(partida, ...)` → quizlib recibe 30 preguntas *ya listas*
- No toca `quizlib.min.js`.

### D5 · Cobertura equilibrada de PDFs
- En `generate_quiz.py --pool`: se agrupan chunks por `ruta_pdf` y se pide al modelo preguntas rotando PDFs (round-robin) para evitar concentración.
- Límite duro: ningún PDF > 30 % del pool.

### D6 · Tests Playwright
- Tests existentes (19) deben seguir pasando.
- Nuevos tests:
  - `quiz_pool.json` existe y tiene ≥ 500 preguntas válidas.
  - Al iniciar partida, se cargan 30 preguntas del pool (no de `quizData`).
  - Dos partidas consecutivas tienen conjuntos de preguntas distintos.
  - Fallback a `quiz.js` si pool no existe.

---

## 3. Ficheros afectados

| Fichero | Qué cambia |
|---|---|
| `backend/generate_quiz.py` | Nuevo modo `--pool N`; lógica de acumulación, deduplicación, cobertura, escritura `js/quiz_pool.json`. |
| `backend/config.py` | Añadir ruta `QUIZ_POOL_PATH = Path('js/quiz_pool.json')`. |
| `js/app.js` | Cargar pool al iniciar; selección aleatoria 30 + barajado opciones; fallback a `quizData`. |
| `js/quiz_pool.json` (nuevo) | Array de ≥ 500 objetos pregunta (mismo esquema `quizData`). |
| `tests/quiz.spec.js` | 4–5 tests nuevos del pool + selección + fallback. |
| `README.md` | Documentar generación del pool: `python backend/generate_quiz.py --pool 1000`. |
| `MEMORY.md` | (Coordinator actualiza al cerrar) |

---

## 4. Funciones puras (con "hoy" como parámetro si aplica)

| Función | Fichero | Qué hace |
|---|---|---|
| `seleccionar_chunks_para_pool(num_preguntas, chunks_por_pdf)` | `generate_quiz.py` | Devuelve lista de chunks rotando PDFs para cobertura equilibrada. |
| `generar_pregunta_desde_chunk(chunk, modelo, semilla)` | `generate_quiz.py` | Llama a Ollama, valida, devuelve objeto pregunta o None. |
| `deduplicar_pool(pool)` | `generate_quiz.py` | Elimina duplicados por enunciado y por conjunto de opciones. |
| `cargar_pool_o_fallback()` | `app.js` | `fetch` pool → si válido devuelve array; sino `quizData`. |
| `construir_partida_desde_pool(pool, tamaño=30)` | `app.js` | `shuffle(pool).slice(0,tamaño)` + baraja opciones de cada una. |

---

## 5. Estrategia de tests

Runner: **`npx playwright test`** (único del proyecto).

### Tests existentes (deben seguir en verde)
1. `quizData` tiene 30 preguntas válidas (quiz.js fallback).
2. Comportamiento quiz: una a una, progreso, sin color si no contesta, verde/rojo al responder, pantalla final.
3. Historial: 5 últimas, colores, vacío, registro, puntuación real.
4. Partidas sin repetición: 30 distintas, orden variable, posición correcta variable, pruebas no tocan historial real.

### Tests nuevos (RF1–RF5)
| Test | Qué verifica | RF |
|---|---|---|
| **Pool existe y es válido** | `js/quiz_pool.json` carga, es array, length ≥ 500, cada item pasa validador de esquema. | RF1, RF4 |
| **Selección 30 del pool** | Al clickar EMPEZAR, `app.js` usa pool (no quizData) y construye 30 preguntas distintas. | RF2 |
| **Dos partidas ≠** | Dos clics seguidos en EMPEZAR producen arrays de 30 con preguntas distintas (salvo solape estadístico < 5 %). | RF2 |
| **Fallback a quiz.js** | Si `quiz_pool.json` borrado/corrupto → partida usa `quizData` y consola avisa. | RF5 |
| **Cobertura PDFs** (opcional, backend) | Script auxiliar verifica que ningún PDF > 30 % del pool. | RF3 |

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Generación de 1000 preguntas tarda horas y puede fallar a mitad | Caché incremental (`logs/preguntas_cache.json`) + reanudación automática; logs detallados. |
| Ollama devuelve preguntas inválidas (formato, idioma, opciones) | Validación estricta en `generate_quiz.py`: 4 opciones, correcta 0–3, explicación, solapamiento ≥ 2 palabras clave con chunk. |
| Pool concentrado en 1–2 PDFs | Selección round-robin de chunks por `ruta_pdf`; límite 30 % por PDF. |
| `js/quiz_pool.json` muy grande → carga lenta en móvil | gzip en servidor (ya hace `server.py`); 300 KB gzip es aceptable. Si falla, partir en chunks o lazy-load. |
| Tests Playwright lentos por carga del pool | Tests usan pool pequeño de fixture (ej. 50 preguntas) generado en `tests/fixtures/`. |

---

## 7. Requisitos cubiertos por parte del plan

| RF | Parte del plan |
|---|---|
| RF1 Pool offline | `generate_quiz.py --pool`, `js/quiz_pool.json`, caché |
| RF2 Selección 30 aleatorias | `app.js: construir_partida_desde_pool()` |
| RF3 Cobertura equilibrada | `seleccionar_chunks_para_pool()` round-robin + límite 30 % |
| RF4 Validación | Validador reutilizado + `deduplicar_pool()` |
| RF5 Compatibilidad | Fallback a `quiz.js`, tests existentes intactos |

---

## 8. Fuera de este plan

- Generación bajo demanda (endpoint `/api/quiz`).
- Estratificación avanzada por tema/artículo (si round-robin falla, futura spec).
- Interfaz de gestión del pool.
- Estadísticas de preguntas vistas/no vistas.