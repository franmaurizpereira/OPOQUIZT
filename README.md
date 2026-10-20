# OPOQUIZ

Aplicación web que crea una **base de datos vectorial** a partir de los PDF de
`pdfs/` y genera un **quiz de 30 preguntas** que se sirve en el navegador con
la librería `quizlib.min.js` y estética retro de los años 80.

## Flujo

```
pdfs/*.pdf  →  extract.py  →  chunk.py  →  embed.py  →  PostgreSQL + pgvector
                                                            ↓
                                       generate_quiz.py  →  js/quiz.js
                                                            ↓
                              index.html + css/style.css + js/app.js  →  QUIZ
```

## Requisitos

- Python 3.10+ (probado con 3.14)
- PostgreSQL con la extensión **pgvector** disponible
- [Ollama](https://ollama.com) en local con los modelos:
  - `locusai/all-minilm-l6-v2:latest` (embeddings, dimensión **384**)
  - `qwen3.8:27b` (generación de las preguntas)

## Puesta en marcha

```bash
# 1. Entorno virtual y dependencias
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. Credenciales de la base de datos (user, passwd, host, port, database)
#    copia la plantilla y rellénala; el fichero real NUNCA se versiona
cp credencial.example.yaml credencial.yaml

# 3. Crear la extensión y la tabla (lo hace la ingesta, pero puede hacerse a mano)
psql -f backend/db.sql

# 4. Ingerir los PDF en la base de datos vectorial
.venv/bin/python backend/ingest.py

# 5. Generar las 30 preguntas y volcar js/quiz.js
.venv/bin/python backend/generate_quiz.py

# 6. Servir la web (interfaz + historial de partidas)
.venv/bin/python backend/server.py --port 8099
#   http://127.0.0.1:8099/index.html
```

El servidor propio sirve la interfaz **y** expone el historial de partidas
(`GET/POST /api/partidas`). Solo publica `index.html`, `css/` y `js/`: el
resto del proyecto (credenciales, backend, repositorio) no es accesible.

## Pruebas

```bash
npm install          # instala @playwright/test
npx playwright test  # valida los datos y el comportamiento del quiz
```

Si Playwright no encuentra el Chromium del sistema, se indica la ruta con la
variable de entorno `CHROMIUM_PATH`.

## Seguridad

- `credencial.yaml` **nunca** se versiona (está en `.gitignore`); usa
  `credencial.example.yaml` como plantilla.
- `mcp.json` no contiene claves: la de Context7 se toma de la variable de
  entorno `CONTEXT7_API_KEY`.
- Arranca siempre la web con `backend/server.py`, **no** con
  `python3 -m http.server`: este último sirve todo el directorio y deja
  `credencial.yaml` y el repositorio accesibles desde el navegador.

## Historial de partidas

La pantalla de inicio muestra las **5 partidas más recientes** con su fecha
(`dd/mm/aaaa`), los **aciertos en verde** y los **fallos en rojo**.

- Se guarda en el fichero local `data/partidas.json` (ignorado por git; se
  conserva lo máximo 100 partidas).
- Se registra automáticamente al terminar cada partida.
- Para vaciarlo: `rm data/partidas.json`.
- La base de datos **no** se toca: no hay ninguna tabla para el historial.
- Las **pruebas automáticas** usan su propio fichero (`data/partidas-test.json`)
  y su propio puerto (8100): nunca tocan tu historial.

## Cada partida es distinta

Al empezar cada partida se **mezclan** el orden de las preguntas y el de las
opciones de cada una, así que la respuesta correcta no siempre está en la
misma posición. El banco (`js/quiz.js`) no se modifica: la mezcla se hace en
el navegador al construir la partida.

El banco de preguntas se revisa con:
```bash
.venv/bin/python backend/reparar_quiz.py            # informa de solapamientos
.venv/bin/python backend/reparar_quiz.py --reparar  # los sustituye por nuevas
```

## Agentes (flujo SDD)

El proyecto se desarrolla con 4 agentes, cada uno con su fichero de
instrucciones en `.pi/agents/`. Están registrados en `.pi/settings.json`
como plantillas de prompt, de modo que en Pi se invocan como comandos:

| Comando | Fichero | Qué hace |
|---|---|---|
| `/planner` | `.pi/agents/planner.md` | Redacta la spec, el plan y las tareas (no escribe código) |
| `/coordinator` | `.pi/agents/coordinator.md` | Dirige el flujo, asigna tareas y actualiza `MEMORY.md` |
| `/implementer` | `.pi/agents/implementer.md` | Implementa **una** tarea aprobada, con los tests primero |
| `/reviewer` | `.pi/agents/reviewer.md` | Valida contra los criterios y emite veredicto (no corrige) |

El trabajo se apoya en `specs/NNN-nombre/`, con `spec.md` (qué y por qué),
`plan.md` (cómo) y `tasks.md` (tareas). Ver `specs/README.md` y `AGENTS.md`.

## Estructura

```
├── index.html                 ← punto de entrada del quiz
├── css/style.css              ← estilos retro (años 80)
├── js/
│   ├── quizlib.min.js         ← librería de quiz (Quiz.Classes, checkAnswers)
│   ├── quiz.js                ← datos de las 30 preguntas (quizData)
│   └── app.js                 ← lógica de la aplicación
├── backend/
│   ├── db.sql                 ← extensión pgvector y tabla chunks
│   ├── config.py              ← credenciales, rutas y modelos
│   ├── extract.py             ← texto (PyMuPDF) y tablas (pdfplumber)
│   ├── chunk.py               ← troceado semántico
│   ├── embed.py               ← embeddings con Ollama
│   ├── ingest.py              ← orquestador de la ingesta
│   ├── generate_quiz.py       ← genera las 30 preguntas y escribe js/quiz.js
│   ├── historial.py           ← historial de partidas (data/partidas.json)
│   └── server.py              ← servidor web: interfaz + API del historial
├── tests/quiz.spec.js         ← pruebas de Playwright
├── playwright.config.js       ← configuración de Playwright
├── package.json               ← dependencias de Node (solo tests)
├── mcp.json                   ← servidores MCP del proyecto (sin claves)
├── AGENTS.md                  ← reglas de orquestación de agentes
├── MEMORY.md                  ← estado del proyecto y decisiones
├── .pi/agents/                ← planner / coordinator / implementer / reviewer
├── .pi/settings.json          ← registra los agentes como comandos de Pi
├── .agents/skills/            ← skills del proyecto (frontend-design)
├── specs/                     ← specs del flujo SDD (spec.md, plan.md, tasks.md)
├── pdfs/                      ← PDF de origen
├── credencial.example.yaml    ← plantilla de credenciales (la real se ignora)
└── requirements.txt           ← dependencias Python
```

## Notas de diseño

- Las **tablas** se guardan como fragmentos separados (`tipo = 'tabla'`), nunca
  mezcladas con el texto corrido de la misma página.
- El texto extraído se limpia de cabeceras/pies repetidos y se unen las
  palabras partidas a final de línea.
- Cada pregunta generada se **valida**: 4 opciones, índice correcto entre 0 y
  3, explicación obligatoria, redacción en español y respaldo literal en el
  fragmento de origen (solapamiento de palabras significativas).
- Las opciones se barajan de forma reproducible para que la respuesta correcta
  no esté siempre en la misma posición.
