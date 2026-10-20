# MEMORY — OPOQUIZ (estado del proyecto)

> Solo datos no sensibles: las credenciales viven en `credencial.yaml` (ignorado
> por git). Plantilla en `credencial.example.yaml`.

## Estado actual (v1 + historial funcionando)
- Flujo completo: 9 PDF → extracción → troceado → embeddings → **2555 chunks**
  (2090 texto / 465 tabla) en PostgreSQL 18 + pgvector 0.8.0 → **30 preguntas**
  en `js/quiz.js` → frontend retro 80s → `npx playwright test` **12/12 ✅**.
- Modelos Ollama: `locusai/all-minilm-l6-v2:latest` (embeddings, 384 dims) y
  `qwen3.8:27b` (preguntas: ~60 s por lote de 3 → ~20 min el total).

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
- **Caché en `logs/preguntas_cache.json`**: permite reanudar generaciones
  largas; se **fusiona** con lo anterior, nunca se sobrescribe.
- **Historial de partidas en fichero local** (`data/partidas.json`, spec 001):
  el usuario decidió **no** crear tabla en PostgreSQL. Como el navegador no
  puede escribir ficheros, `backend/server.py` sirve la interfaz y expone
  `GET/POST /api/partidas`. Se muestran las 5 últimas: fecha `dd/mm/aaaa`,
  aciertos en verde y fallos en rojo.
- **Skill `frontend-design` adaptada a OPOQUIZ** (en español, retro 80s), sin
  `skills-lock.json` para que `npx skills update` no la pise (original en
  `UPSTREAM.md`).
- **Dirección de arte "terminal de cristal 1987"**: bisel de cabina, viñeta de
  tubo, barra de espectro, casillas de radio a píxeles, progreso de 30 celdas
  con cursor, `prefers-reduced-motion` respetado.

## Errores a evitar
- El `<label>` debe **envolver** al `input type=radio`; si son hermanos, el clic
  no marca la opción y el quiz parece roto.
- `clearHighlights` de quizlib borra las clases en cada `checkAnswers`: hay que
  **reaplicar** el marcado verde/rojo después de comprobar.
- **No arrancar la web con `python3 -m http.server`**: sirve todo el
  directorio y deja `credencial.yaml` y el repo accesibles por HTTP. Usar
  `backend/server.py`, que solo publica la interfaz.
- **Reiniciar el servidor tras tocar el backend**: el módulo queda importado
  en memoria y los cambios no se ven (pasó con `historial.py`).
- Procesos en segundo plano: el equipo reinició y los mató. Usar `setsid` +
  log en `logs/`, nunca `/tmp`. `npx add-mcp` y `npx skills add` son
  interactivos: fallan sin TTY.
- `add-mcp` escribe una entrada stdio circular; en Pi los MCP remotos van con
  `"url"`. **Nunca escribir claves en `mcp.json`**: se usa `${CONTEXT7_API_KEY}`.
- **Si Ollama devuelve 500 `error loading model: vector::_M_range_check`**, el
  blob del modelo está corrupto: `ollama pull locusai/all-minilm-l6-v2:latest`.
