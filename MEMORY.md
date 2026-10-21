# MEMORY — OPOQUIZ (estado del proyecto)

> Solo datos no sensibles: las credenciales viven en `credencial.yaml` (ignorado
> por git). Plantilla en `credencial.example.yaml`.

## Estado actual (v1 + historial + partidas variables + pool)
- Flujo completo: 9 PDF → extracción → troceado → embeddings → **2555 chunks**
  (2090 texto / 465 tabla) en PostgreSQL 18 + pgvector 0.8.0 → **30 preguntas**
  en `js/quiz.js` → frontend retro 80s → `npx playwright test` **26 tests** (19
  del quiz + 7 del pool) y `backend/test_pool.py` **24/24 ✅**.
- Modelos Ollama: `locusai/all-minilm-l6-v2:latest` (embeddings, 384 dims) y
  `qwen3.8:27b` (preguntas: ~60 s por lote de 3 → ~20 min el total).
- **Pool grande (spec 003)**: `js/quiz_pool.json` con **600 preguntas** para que
  cada partida sea un examen distinto. Se genera offline con
  `python backend/generate_quiz.py --pool 600` (≈35 min con OpenRouter, ≈5 h
  con el modelo local) y se publica en cada checkpoint, así que se puede jugar
  mientras se genera. Si el pool no está, el frontend usa las 30 preguntas de
  `js/quiz.js` sin quejarse. Verificado con `backend/verificar_pool.py`:
  9 documentos con reparto 10,1 %–11,3 %, sin duplicados y con la respuesta
  correcta repartida entre las cuatro opciones.

## Reglas permanentes (no negociables)
- **Una pregunta sin contestar NO muestra ningún color** (ni verde ni rojo) ni
  explicación: no se puede adelantar la respuesta correcta. Solo las preguntas
  ya respondidas llevan marcado (checklist de `reviewer.md`).
- Comentarios y textos de UI **en español**; estética **retro 80s** (fondo
  oscuro, neones lima/cian/magenta/amarillo, monoespaciada, bordes pixelados).
- Sin frameworks, CDN ni Google Fonts: el quiz funciona sin red.
- La web se sirve **solo** con `backend/server.py`: publica `index.html`,
  `css/` y `js/`, nunca el resto del proyecto.

## Decisiones y por qué
- **pgvector a mano**: el paquete de Fedora no coincidía con el `sharedir` de
  PostgreSQL 18 (PGDG); se copiaron `vector*` y `vector.so` a `/usr/pgsql-18/`.
  **Repetir tras cada actualización de PostgreSQL**.
- **`js/quizlib.min.js` = ALPSquid/quizlib v1.0.1** (DOM-based, se muestra una
  pregunta a la vez con `.oculto`; no se toca). `app.js` la usa de verdad:
  `new Quiz(...)`, `checkAnswers(false)`, `quiz.result.results` y marcado con
  `Quiz.Classes.CORRECT/INCORRECT`.
- **Generación con JSON Schema** en `format` de Ollama: pidiendo solo `"json"`
  el modelo devolvía un objeto y rompía el parser. Validación de respaldo por
  solapamiento de palabras significativas con el fragmento origen; barajado
  reproducible (semilla `20240517`).
- **Pool de preguntas en `js/quiz_pool.json`** (spec 003): el juego elige 30
  preguntas al azar del pool en cada partida, baraja el orden de las preguntas
  y el de las opciones (recalculando `correcta`) y **evita que dos preguntas de
  la misma partida repitan opciones** (son las que delatan la respuesta). El
  pool se genera **una sola vez, offline**: jugar no necesita ni Ollama ni
  PostgreSQL ni red.
- **OpenRouter para generar el pool** (`minimax/minimax-m3.1-flash:free`):
  con el modelo local de 27B en CPU cada pregunta tardaba ~29 s (5 h para 600);
  con el modelo remoto son ~6 s. La clave se lee de la variable de entorno
  `OPENROUTER_API_KEY` (**nunca** en el repo); sin ella se usa Ollama en local.
  Detalles que costaron tiempo:
  - La respuesta debe pedirse en **streaming (SSE)**: con la respuesta
    completa, si el proveedor deja de enviar datos la conexión se queda
    abierta para siempre y el proceso parece colgado.
  - Con streaming, los *pings* de mantenimiento reinician el tiempo de espera
    del socket: hay que comprobar el **tiempo total** de la petición, no solo
    el de cada lectura.
  - El modelo `:free` no aguanta demasiada concurrencia: con 8 lotes en
    paralelo va bien; con 14 se abandonan lotes por exceso de tiempo.
- **El pool se carga una sola vez en el frontend** (la promesa se guarda): si
  se cargara dos veces, el `.then()` inicial reconstruía el quiz a mitad de
  partida y cambiaba la pregunta bajo los pies del jugador.
- **Caché aparte para el pool**: `logs/pool_cache.json` (no toca
  `logs/preguntas_cache.json` del modo normal). Se fusiona al arrancar y nunca
  se sobrescribe: si se corta, se relanza y continúa.
- **Historial de partidas en fichero local** (`data/partidas.json`, spec 001):
  el usuario decidió **no** crear tabla en PostgreSQL. Como el navegador no
  puede escribir ficheros, `backend/server.py` sirve la interfaz y expone
  `GET/POST /api/partidas`. Se muestran las 5 últimas: fecha `dd/mm/aaaa`,
  aciertos en verde y fallos en rojo. Las pruebas usan otro fichero y otro
  puerto (`OPOQUIZ_HISTORIAL` + 8100) para no tocar el historial real.
- **Cada partida se mezcla** (spec 002): se barajan el orden de las preguntas
  y el de las opciones (recalculando `correcta` y renumerando A/B/C/D) sobre
  una copia de `quizData`, que no se modifica. En el banco no puede haber dos
  preguntas con las mismas opciones: `deduplicar()` y `backend/reparar_quiz.py`
  lo comprueban por opciones, por enunciado y por texto de respuesta correcta.- **Skill `frontend-design` adaptada a OPOQUIZ** (en español, retro 80s), sin
  `skills-lock.json` para que `npx skills update` no la pise (original en
  `UPSTREAM.md`).
- **Dirección de arte "terminal de cristal 1987"**: bisel de cabina, viñeta de
  tubo, barra de espectro, casillas de radio a píxeles, progreso de 30 celdas
  con cursor, `prefers-reduced-motion` respetado.

## Errores a evitar
- **`pkill -f "genera..."` mata al propio shell**: el patrón coincide con la
  línea de comandos del bash que lo ejecuta. Usar corchetes:
  `pkill -f "[g]enerate_quiz.py --pool"`.
- **El modelo `:free` de OpenRouter se queda en cola** cuando hay varias
  peticiones a la vez: la llamada no falla, se queda colgada. Poner tiempo
  máximo de espera (120 s) y reintentar con espera creciente.
- **El modelo coloca la respuesta correcta casi siempre en la opción 0**: al
  publicar el pool se barajan las opciones (semilla `SEMILLA_OPCIONES = 1`) y
  se recalcula `correcta`, para que el jugador no acierte por costumbre.
- **Lotes de 10 preguntas por llamada al modelo**: el modelo mezcla los
  índices de contexto y casi todo se descarta. Con **4 por llamada** la tasa
  de aciertos es del ~94 %.
- **El enunciado solo puede parafrasear el texto**: el umbral de solapamiento
  del enunciado está en 0,20 y el de la opción correcta en 0,35. Con 0,30/0,45
  se descartaba casi la mitad de las preguntas.
- El `<label>` debe **envolver** al `input type=radio`; si son hermanos, el clic
  no marca la opción y el quiz parece roto.
- `clearHighlights` de quizlib borra las clases en cada `checkAnswers`: hay que
  **reaplicar** el marcado verde/rojo después de comprobar.
- **No arrancar la web con `python3 -m http.server`**: sirve todo el
  directorio y deja `credencial.yaml` y el repo accesibles por HTTP. Usar
  `backend/server.py`, que solo publica la interfaz.
- **Reiniciar el servidor tras tocar el backend**: el módulo queda importado
  en memoria y los cambios no se ven (pasó con `historial.py`).
- **Las pruebas automáticas no deben escribir en el historial real**: si lo
  hacen, la puntuación de la persona aparece sustituida por la de las pruebas
  (pasó: se veían 9 aciertos en lugar del 80 % real). Hoy se aíslan con
  `OPOQUIZ_HISTORIAL` y el puerto 8100.
- Procesos en segundo plano: el equipo reinició y los mató. Usar `setsid` +
  log en `logs/`, nunca `/tmp`. `npx add-mcp` y `npx skills add` son
  interactivos: fallan sin TTY.
- `add-mcp` escribe una entrada stdio circular; en Pi los MCP remotos van con
  `"url"`. **Nunca escribir claves en `mcp.json`**: se usa `${CONTEXT7_API_KEY}`.
- **Si Ollama devuelve 500 `error loading model: vector::_M_range_check`**, el
  blob del modelo está corrupto: `ollama pull locusai/all-minilm-l6-v2:latest`.
