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

# 6. Servir la web
python3 -m http.server 8099
#   http://127.0.0.1:8099/index.html
```

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
│   └── generate_quiz.py       ← genera las 30 preguntas y escribe js/quiz.js
├── tests/quiz.spec.js         ← pruebas de Playwright
├── playwright.config.js       ← configuración de Playwright
├── package.json               ← dependencias de Node (solo tests)
├── mcp.json                   ← servidores MCP del proyecto (sin claves)
├── AGENTS.md                  ← reglas de orquestación de agentes
├── MEMORY.md                  ← estado del proyecto y decisiones
├── .pi/agents/                ← planner / coordinator / implementer / reviewer
├── .agents/skills/            ← skills del proyecto (frontend-design)
├── pdfs/                      ← PDF de origen
├── credencial.example.yaml    ← plantilla de credenciales (la real se ignora)
└── requirements.txt
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
