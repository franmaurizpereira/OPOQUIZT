# MEMORY — OPOQUIZ (estado del proyecto)

> Solo datos no sensibles: las credenciales viven en `credencial.yaml` (ignorado
> por git). Plantilla en `credencial.example.yaml`.

## Estado actual
- Flujo completo: 9 PDF → extracción → troceado → embeddings → **2555 chunks**
  (2090 texto / 465 tabla) en PostgreSQL 18 + pgvector 0.8.0 → 30 preguntas en
  `js/quiz.js` → frontend Fallout 50s → `npx playwright test` **55/55**
  (19 quiz + 8 pool + 9 revisión + 10 sonido + 9 temario) y
  `backend/test_pool.py` **62/62 ✅**.
- Modelos Ollama: `locusai/all-minilm-l6-v2:latest` (embeddings, 384 dims),
  `qwen3.8:27b` (local, ~66 s por pregunta) y `qwen3:14b`/`qwen3:8b` para
  pruebas. Para generar de verdad: un API compatible con OpenAI (DeepSeek
  Flash directo u OpenRouter), configurable por entorno.
- **Pool de 2.647 preguntas** (`js/quiz_pool.json`, spec 007): 9 temas
  (97–624 por tema), **95,4 % del texto** y 98,6 % de las páginas cubiertas.
  Cada pregunta lleva su `tema`; la partida reparte 3 por tema + 3 libres y
  prefiere las no vistas (rotación en `localStorage`, `opoquiz-vistas`), con
  reinicio de ciclo al agotarse. Sin pool, el frontend usa `js/quiz.js`.
  `backend/verificar_pool.py` comprueba también la cobertura contra la BD.
- **Revisión de la partida** (spec 004): al terminar, REVISAR PARTIDA abre una
  modal con las 30 preguntas, la correcta, la elegida y la explicación, con
  filtros y resumen. El detalle se guarda en `data/partidas.json` y se puede
  repasar desde el inicio; solo las **20 más recientes** lo conservan.
- **Sonido** (spec 006): efectos **sintetizados** con Web Audio en
  `js/audio.js` (0 ficheros, 0 red). Un solo efecto por acción, nada antes del
  primer gesto, control `SONIDO: SÍ/NO` en la cabecera con atajo `M` y
  preferencia en `localStorage` (`opoquiz-sonido`). Sin música de fondo.

## Reglas permanentes (no negociables)
- **Una pregunta sin contestar NO muestra ningún color** ni explicación: no se
  puede adelantar la respuesta correcta.
- Comentarios y textos de UI **en español**; estética **retro-futurismo de los
  años 50 (Fallout)**: cartón marrón, azul Vault Boy, naranja de menús, verde y
  rojo de terminal, tipografías locales (Anton, Oswald, Courier Prime, VT323).
  El neón de los 80 (spec 003) ya no manda.
- Sin frameworks, CDN ni fuentes remotas: el quiz funciona sin red. Las
  fuentes viven en `css/fuentes/` con su licencia OFL.
- Los estados de acierto y fallo **nunca se comunican solo con color**: van
  con borde, fondo o icono.
- El **sonido nunca es el único canal**: refuerza, no informa. Siempre hay
  control visible, con el estado escrito, y nada suena antes del primer gesto.
- La web se sirve **solo** con `backend/server.py`: publica `index.html`,
  `css/` y `js/`, nunca el resto del proyecto.

## Decisiones y por qué
- **Sonido sintetizado, no ficheros**: con Web Audio no entra ni un byte de
audio en el repositorio, no hay licencias que documentar y no hay que abrir
carpetas nuevas en `server.py`. Descartado servir `.ogg` (100–300 KB + CC0 +
whitelist del servidor).
- **Cobertura medida, no estimada**: 90 % del texto, 85 % por documento y
  95 % de las páginas. Se mide con `cobertura()` en `verificar_pool.py`
  uniendo los `contexto_id` de la caché con la BD. Se descartó medir por
  número de fragmentos: el 11 % de los trozos solo tiene el 2,3 % del texto.
- **Reparto proporcional al texto y fragmentos intercalados por documento**:
  el reparto igual por PDF dejaba a Gobierno y TREBEP al 14 %; y generar en
  bloques por documento dejaba cuatro temarios al 0 % si la ejecución se
  cortaba. Ahora se intercala antes de trocear en lotes.
- **Semilla de opciones por enunciado**: con una sola semilla el 41,6 % de
  las correctas caía en la A; ahora cada pregunta baraja con la semilla de su
  enunciado (FNV-1a).
- **`IndiceDuplicados`**: comparar cada pregunta con las 2.000 anteriores
  dominaba el tiempo. El índice compara solo las que comparten palabras u
  opciones; una prueba lo compara con la fuerza bruta.
- **pgvector a mano**: el paquete de Fedora no coincidía con el `sharedir` de
  PostgreSQL 18 (PGDG); se copiaron `vector*` y `vector.so` a `/usr/pgsql-18/`.
  **Repetir tras cada actualización de PostgreSQL**.
- **`js/quizlib.min.js` = ALPSquid/quizlib v1.0.1** (DOM-based, una pregunta
  a la vez con `.oculto`; no se toca). `app.js` la usa de verdad: `new Quiz()`,
  `checkAnswers(false)`, `quiz.result.results` y el marcado con
  `Quiz.Classes.CORRECT/INCORRECT`.
- **Generación con JSON Schema** en `format` de Ollama: pidiendo solo `"json"`
  el modelo devolvía un objeto y rompía el parser. Validación de respaldo por
  solapamiento de palabras significativas con el fragmento origen; barajado
  reproducible (semilla `20240517`).
- **Pool**: 30 preguntas al azar del pool, con preguntas y opciones barajadas
  (recalculando `correcta` y renumerando A/B/C/D) sobre una copia de
  `quizData`, que no se modifica. En el banco no puede haber dos preguntas con
  las mismas opciones: `deduplicar()` y `backend/reparar_quiz.py` lo comprueban
  por opciones, enunciado y texto de respuesta correcta.
- **El pool se carga una sola vez en el frontend** (se guarda la promesa): si
  se cargara dos veces, el `.then()` inicial reconstruía el quiz a mitad de
  partida y cambiaba la pregunta al jugador.
- **OpenRouter para generar el pool** (`minimax/minimax-m3.1-flash:free`): con
  el modelo local de 27B en CPU cada pregunta tardaba ~29 s (5 h para 600); con
  el remoto son ~6 s. La clave se lee de `OPENROUTER_API_KEY` (**nunca** en el
  repo); sin ella se usa Ollama en local. Lo que costó tiempo:
  - La respuesta debe pedirse en **streaming (SSE)**: con la respuesta
    completa, si el proveedor deja de enviar datos la conexión se queda
    abierta para siempre y el proceso parece colgado.
  - Con streaming, los *pings* reinician el tiempo de espera del socket: hay
    que comprobar el **tiempo total** de la petición, no solo el de cada
    lectura.
  - El modelo `:free` no aguanta demasiada concurrencia: con 8 lotes en
    paralelo va bien; con 14 se abandonan lotes por exceso de tiempo.
- **Caché aparte para el pool**: `logs/pool_cache.json` (no toca
  `logs/preguntas_cache.json`). Se fusiona al arrancar y nunca se sobrescribe:
  si se corta, se relanza y continúa.
- **Explicaciones del pool**: `--mejorar-explicaciones` reescribe las que
  dicen "el texto" o "el pasaje" (65 de 600) para que se entiendan solas en la
  revisión. Si la nueva no supera la validación, se conserva la anterior.
- **Revisión**: la opción elegida se guarda **al contestar** (evento `change`,
  `elegidas[i]`), no al terminar: así no hay que leer el DOM, que puede haber
  cambiado. El acierto se recalcula comparando con `correcta`. Las opciones
  llevan `data-correcta` y `data-elegida` para poder comprobarlas en las
  pruebas sin depender de las clases de color.
- **Historial en fichero local** (`data/partidas.json`, spec 001): se decidió
  **no** crear tabla en PostgreSQL. El navegador no puede escribir ficheros,
  así que `backend/server.py` expone `GET/POST /api/partidas`. Se muestran
  las 5 últimas: fecha `dd/mm/aaaa`, aciertos en verde y fallos en rojo. Las
  pruebas usan otro fichero y otro puerto (`OPOQUIZ_HISTORIAL` + 8100).
- **Dirección de arte "vault de los años 50"** (spec 005): sustituye al neón
  CRT de los 80 por pedido explícito del usuario (2026-10-22). Del diseño
  anterior se conservan la viñeta, el grano, las casillas de radio dibujadas, el
  progreso de 30 celdas y `prefers-reduced-motion`; se eliminó el parpadeo del
  título.
- **Fuentes locales, no Google Fonts**: `css/fuentes/*.woff2` (152 KB, OFL). Un
  `@import` remoto bloquearía el primer pintado sin conexión.
- **El color de estado del texto va en su variante clara** (`--verde-texto`,
  `--rojo-texto`): el rojo de marca `#d0433a` sobre el panel no llegaba a AA.
  Los tests leen `--verde`/`--rojo` y aceptan cualquiera de las dos variantes.
- **Los cambios de estilo tienen su propio flujo** (spec 005): el Graphic
  Designer solo toca `css/style.css` y el Reviewer de estilo lo valida con
  5 gates. `AGENTS.md` §2, §3, §5 y §7 quedan actualizados con esa rama.

## Errores a evitar
- **`pkill -f "genera..."` mata al propio shell**: el patrón coincide con la
  línea de comandos del bash que lo ejecuta. Usar corchetes:
  `pkill -f "[g]enerate_quiz.py --pool"`.
- El modelo `:free` de OpenRouter **se queda en cola** con varias peticiones a
  la vez: la llamada no falla, se queda colgada. Poner tiempo máximo (120 s) y
  reintentar con espera creciente.
- El modelo coloca la respuesta correcta casi siempre en la opción 0: al
  publicar el pool se barajan las opciones (semilla `SEMILLA_OPCIONES = 1`) y
  se recalcula `correcta`, para que el jugador no acierte por costumbre.
- Lotes de 10 preguntas por llamada al modelo: mezcla los índices de contexto
  y casi todo se descarta. Con **4 por llamada** la tasa es del ~94 %.
- El enunciado solo puede parafrasear el texto: el umbral de solapamiento del
  enunciado está en 0,20 y el de la opción correcta en 0,35. Con 0,30/0,45 se
  descartaba casi la mitad de las preguntas.
- El `<label>` debe **envolver** al `input type=radio`; si son hermanos, el clic
  no marca la opción y el quiz parece roto.
- `clearHighlights` de quizlib borra las clases en cada `checkAnswers`: hay que
  **reaplicar** el marcado verde/rojo después de comprobar.
- **No arrancar la web con `python3 -m http.server`**: sirve todo el directorio
  y deja `credencial.yaml` y el repo accesibles por HTTP. Usar
  `backend/server.py`, que solo publica la interfaz.
- **Reiniciar el servidor tras tocar el backend**: el módulo queda importado en
  memoria y los cambios no se ven (pasó con `historial.py`).
- **Las pruebas automáticas no deben escribir en el historial real**: si lo
  hacen, la puntuación de la persona aparece sustituida por la de las pruebas.
  Hoy se aíslan con `OPOQUIZ_HISTORIAL` y el puerto 8100.
- Procesos en segundo plano: el equipo reinició y los mató. Usar `setsid` +
  log en `logs/`, nunca `/tmp`. `npx add-mcp` y `npx skills add` son
  interactivos: fallan sin TTY.
- `add-mcp` escribe una entrada stdio circular; en Pi los MCP remotos van con
  `"url"`. **Nunca escribir claves en `mcp.json`**: se usa `${CONTEXT7_API_KEY}`.
- **Si Ollama devuelve 500 `error loading model: vector::_M_range_check`**, el
  blob del modelo está corrupto: `ollama pull locusai/all-minilm-l6-v2:latest`.
