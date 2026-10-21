# Spec 003 · Pool grande de preguntas para partidas únicas

**Estado:** borrador
**Fecha:** 2026-10-21
**Solicitud original:** "La idea es que cada partida tenga 30 nuevas preguntas aleatorias para que vaya preguntando la información de los 9 PDFs, que cada partida sea lo suficientemente distinta para ir aprendiéndose los temas del PDF, como si alguien te estuviera haciendo un examen."

---

## 1. Problema

Hoy el quiz usa un banco fijo de 30 preguntas (`js/quiz.js`). Cada partida muestra las **mismas 30 preguntas** (solo cambia el orden y la posición de las opciones). El jugador memoriza las respuestas en pocas partidas y deja de aprender.

## 2. Objetivo

Que **cada partida sea un examen distinto** extrayendo 30 preguntas al azar de un **pool grande (500–1000 preguntas)** generado **una sola vez offline**, cubriendo todo el contenido de los 9 PDFs. El jugador ve preguntas nuevas durante muchas partidas y aprende el temario completo.

## 3. Alcance

**Incluido**
- Generación offline de un pool de **500–1000 preguntas válidas** (mismo formato que `quizData`).
- Almacenamiento del pool en `js/quiz_pool.json` (array de objetos pregunta).
- Selección aleatoria de **30 preguntas sin repetición** al iniciar cada partida.
- Cobertura equilibrada de los 9 PDFs y de sus temas (no concentrar en pocos artículos).
- Validación de cada pregunta generada (4 opciones, índice correcto 0–3, explicación, respaldo en chunk origen).
- Deduplicación por enunciado y por conjunto de opciones (como en spec 002).
- Caché incremental en `logs/preguntas_cache.json` para reanudar generaciones largas.
- Compatibilidad total con `quizlib.min.js` (no se toca) y `app.js` (cambio mínimo).
- Cero dependencias en runtime: el quiz sigue funcionando **sin red, sin BD, sin Ollama**.

**Excluido**
- Generación de preguntas en caliente durante la partida.
- Crear tablas nuevas en PostgreSQL.
- Modificar `quizlib.min.js`.
- Ampliar el pool automáticamente tras cada partida (ver decisiones).
- Sistema de usuarios, perfiles o sincronización.

## 4. Requisitos funcionales (EARS)

### RF1 · Pool grande generado offline
- EL SISTEMA DEBE generar un pool de **500–1000 preguntas** ejecutando un script offline.
- EL SISTEMA DEBE almacenar el pool en `js/quiz_pool.json` como array de objetos con el mismo esquema que `quizData`.
- EL SISTEMA DEBE poder reanudar la generación si se interrumpe (caché incremental).
- EL SISTEMA NO DEBE requerir conexión a BD u Ollama durante el juego.

### RF2 · Selección aleatoria de 30 preguntas por partida
- AL INICIAR CADA PARTIDA, EL SISTEMA DEBE seleccionar **30 preguntas distintas** del pool.
- LA SELECCIÓN DEBE SER ALEATORIA y uniforme (cada pregunta misma probabilidad).
- NINGUNA PREGUNTA SE REPITE dentro de la misma partida.
- EL ORDEN de las 30 seleccionadas DEBE barajarse.
- EL ORDEN de las opciones de CADA pregunta DEBE barajarse (recalculando la correcta).

### RF3 · Cobertura temática equilibrada
- EL GENERADOR DEBE distribuir las preguntas entre los 9 PDFs y sus secciones.
- NO DEBE CONCENTRAR más del 30 % del pool en un solo PDF.
- SE DEBE EVITAR que varias preguntas del pool tengan el mismo enunciado o las mismas opciones.

### RF4 · Validación y calidad
- CADA PREGUNTA DEL POOL DEBE pasar la validación existente (4 opciones, correcta 0–3, explicación, solapamiento con chunk).
- EL POOL NO DEBE CONTENER duplicados (mismo criterio que `deduplicar()` y `reparar_quiz.py`).
- LAS PREGUNTAS DEBEN ESTAR EN ESPAÑOL y mantener el tono de oposiciones.

### RF5 · Compatibilidad y retrocompatibilidad
- EL ARCHIVO `js/quiz.js` EXISTENTE DEBE seguir funcionando como fallback (si no hay pool).
- LA INTERFAZ DEBE seguir íntegramente en español y estilo retro 80s.
- LA SUITE DE PRUEBAS (`npx playwright test`) DEBE seguir en verde.

## 5. Casos límite

| Caso | Comportamiento esperado |
|------|------------------------|
| Pool con < 30 preguntas | El sistema avisa y usa `js/quiz.js` como fallback. |
| Generación interrumpida (corte de luz, error Ollama) | Al relanzar, continúa desde `logs/preguntas_cache.json` sin repetir ni perder preguntas ya válidas. |
| Pregunta generada sin respaldo en chunk | Se descarta y se genera otra en su lugar. |
| Dos preguntas con opciones idénticas | Solo se queda una (deduplicación por opciones). |
| Jugador juega 20 partidas seguidas | Ve 600 preguntas distintas (si pool ≥ 600); sin repetir en la misma partida. |
| `js/quiz_pool.json` no existe o está corrupto | Se usa `js/quiz.js` y se loguea aviso en consola. |

## 6. Criterios de aceptación (verificables)

1. Existe `js/quiz_pool.json` con **≥ 500 preguntas válidas** (formato `quizData`).
2. Al iniciar una partida, `app.js` selecciona 30 preguntas aleatorias del pool sin repetición.
3. En una partida, los 30 enunciados son distintos entre sí.
4. Dos partidas consecutivas muestran conjuntos de preguntas distintos (salvo coincidencia estadística mínima).
5. El pool cubre los 9 PDFs: ningún PDF aporta > 30 % de las preguntas.
6. No hay duplicados en el pool (mismo enunciado o mismas opciones).
7. `npx playwright test` pasa (19 tests actuales + nuevos tests del pool).
8. El quiz funciona offline: sin BD, sin Ollama, solo `backend/server.py` sirviendo estáticos.
9. La generación offline se puede reanudar desde `logs/preguntas_cache.json`.
10. Tiempo de generación total documentado (estimado: 3–6 horas para 1000 preguntas).

## 7. Decisiones tomadas / por tomar

| # | Decisión | Alternativa descartada | Por qué |
|---|----------|------------------------|---------|
| D1 | Pool en **archivo JSON servido estáticamente** (`js/quiz_pool.json`) | Pool en BD + endpoint `/api/quiz` | Cero latencia, cero deps en runtime, coherente con arquitectura actual. |
| D2 | **500–1000 preguntas** generadas **una sola vez** offline | Regenerar pool tras cada partida | Generar 30 preguntas tarda ~10 min; 1000 tarda ~5 h. Inaceptable en caliente. |
| D3 | Selección aleatoria uniforme simple (`shuffle(pool).slice(0,30)`) | Muestreo estratificado por PDF/tema | Simplicidad; con 1000 preguntas la cobertura natural es suficiente. Si falla, se añade estratificación en futura iteración. |
| D4 | `js/quiz.js` se mantiene como **fallback** y para tests | Borrar `js/quiz.js` y usar solo pool | Seguridad: si pool falla, el quiz sigue funcionando. Tests actuales usan `quizData` de `quiz.js`. |
| D5 | Caché incremental en `logs/preguntas_cache.json` (fusiona, no sobrescribe) | Sin caché / sobrescribir | Generación de 1000 preguntas = horas; fallos de red/Ollama son probables. |

## 8. Fuera de alcance

- Generación bajo demanda (endpoint `/api/quiz`).
- Estadísticas de qué preguntas ha visto el jugador.
- Adaptación de dificultad según rendimiento.
- Exportar/importar pool.
- Interfaz para gestionar el pool desde el navegador.