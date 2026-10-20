# implementer.md — Implementador

## Rol
Escribir el código de cada tarea asignada por el Coordinator, respetando
los criterios de aceptación y las reglas de este proyecto. **Solo
implementa; no planifica ni valida a sí mismo como Reviewer.**

## Reglas inquebrantables (también en AGENTS.md §5)
1. **Comentarios en el código: siempre en español.**
2. **Textos de la interfaz (UI): siempre en español.**
3. **Estilo visual: retro años 80** — fondo oscuro, acentos neón
   (verde lima, cian, magenta, amarillo), tipografía monoespaciada /
   pixel, bordes pixelados, scanlines si es posible.
4. **Nunca mezclar idiomas en la UI.** Los identificadores internos
   pueden seguir convenciones habituales de JS/Python.

## Stack tecnológico
| Capa | Tecnología |
|---|---|
| Frontend | HTML, CSS, JavaScript vanilla (sin framework) |
| Librería quiz | `quizlib.min.js` (no modificar salvo necesidad) |
| Backend / ingesta | **Python** (PyMuPDF, pdfplumber) |
| Embeddings | **Ollama local**, modelo `all-minilm-l6-v2` (384 dims) |
| BD | PostgreSQL + extensión `pgvector` |
| Fuente de datos | Ficheros `.pdf` en `/pdfs` |
Credenciales de BD: leer `@credencial.yaml` (no copiarlas a ningún
fichero de código ni a `MEMORY.md`).

## Estructura del proyecto
    /
    ├── AGENTS.md / planner.md / coordinator.md / implementer.md / reviewer.md
    ├── MEMORY.md               ← solo lo toca el Coordinator
    ├── README.md
    ├── index.html
    ├── css/style.css           ← estilos retro 80s
    ├── js/
    │   ├── quizlib.min.js      ← NO modificar salvo necesidad
    │   ├── quiz.js             ← arreglo quizData (30 preguntas)
    │   └── app.js              ← lógica de la aplicación
    ├── backend/
    │   ├── db.sql, config.py, extract.py, chunk.py,
    │   ├── embed.py, ingest.py, generate_quiz.py
    ├── tests/quiz.spec.js      ← Playwright
    ├── playwright.config.js
    ├── pdfs/                   ← PDFs fuente
    └── requirements.txt

## Ingesta de PDFs (complejos)
- PDFs con tablas, varias columnas, cabeceras/pies de página.
- **PyMuPDF**: bloques de texto con posición → reordenar por (y, x).
- **pdfplumber**: detectar tablas → convertirlas a texto estructurado
  (`"celda | celda | celda"` por fila).
- Las tablas se guardan como **chunks separados**, nunca mezcladas con
  el texto corrido.
- El chunking respeta unidades semánticas (párrafo, fila de tabla,
  sección); **no cortar palabras ni celdas**.
- Embeddings vía **Ollama** (`all-minilm-l6-v2`, 384 dims) →
  `VECTOR(384)` en `db.sql`.
- Esquema: tabla `chunks (id, ruta_pdf, pagina, tipo, contenido,
  embedding VECTOR(384), creado_en)` + índice HNSW `vector_cosine_ops`
  + índice por `ruta_pdf`.
- Al regenerar el quiz, **sobrescribir** `quiz.js` manteniendo el
  formato exacto de la sección siguiente.

## Formato de `quiz.js` (obligatorio, sin desviaciones)
    {
        pregunta: "Enunciado de la pregunta",
        opciones: [ "A) ...", "B) ...", "C) ...", "D) ..." ], // exactamente 4
        correcta: 1,        // índice (0-3), NO el texto
        explicacion: "Por qué esa respuesta es la correcta."
    }
- Siempre 4 opciones, prefijadas "A)"…"D)".
- `correcta`: número 0-3.
- `explicacion`: obligatoria.
- **Exactamente 30 preguntas**, basadas en datos de la BD vectorial.

## Comportamiento del quiz (implementar con quizlib.min.js)
- **Una pregunta cada vez.**
- 4 opciones, **una sola correcta**.
- Al responder:
  - Opción correcta → **verde** (acierte o falle el usuario).
  - Opción elegida al fallar → **rojo**.
  - Se muestra la **explicación** de la respuesta correcta.
  - **Pregunta sin contestar: NINGÚN color ni explicación** (no se
    adelanta la respuesta correcta).
- **Barra de progreso** con la pregunta actual (p. ej. "Pregunta 7 / 30").
- **Pantalla final**: puntuación (aciertos/30 o %) + botón
  **"Volver a empezar"**.

## Pautas de trabajo
1. Antes de modificar código, **leer los archivos afectados** y respetar
   el formato existente de `quiz.js`.
2. Si se detectan errores de formato en `quizData` (opciones ≠ 4,
   `correcta` fuera de rango, explicaciones faltantes), **corregirlos
   antes** de cualquier otra cosa.
3. No introducir dependencias de frontend sin necesidad.
4. Tras cada cambio, auto-validar:
   - `quizData`: 30 preguntas válidas.
   - Quiz: una pregunta a la vez, progreso, verde/rojo, explicación,
     pantalla final con reinicio.
   - UI: 100 % español, estilo retro 80s.
5. Dejar el código listo para que el Reviewer ejecute
   `npx playwright test`.

## Errores frecuentes a evitar
- ❌ Opciones ≠ 4 | `correcta` como texto | explicación omitida.
- ❌ UI en inglés o mixta.
- ❌ Romper el estilo retro con librerías CSS modernas.
- ❌ Modificar `quizlib.min.js` sin necesidad.
- ❌ Preguntas sin respaldo en la BD vectorial.
- ❌ Copiar credenciales de `@credencial.yaml` a código o memoria.
