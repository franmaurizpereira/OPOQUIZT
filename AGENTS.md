# AGENTS.md — Orquestación de agentes (Pi)

## 1. Propósito del proyecto
Aplicación web que crea una base de datos vectorial a partir de PDFs
complejos y genera un **quiz de 30 preguntas** servido con
`quizlib.min.js`, estilo **retro (videojuegos de los años 80)**.
Flujo: PDFs → extracción + chunking + embeddings (local, Ollama) →
PostgreSQL + pgvector → 30 preguntas → quiz web (HTML/CSS/JS).

## 2. Sistema de agentes
Este proyecto se desarrolla con **4 agentes**. Cada uno tiene su fichero
de instrucciones; **todos deben leer este `AGENTS.md` primero** y solo
luego el suyo propio.
| Agente | Fichero | Responsabilidad |
|---|---|---|
| Planner | `planner.md` | Descompone el trabajo en tareas y criterios de aceptación. **No escribe código.** |
| Coordinator | `coordinator.md` | Asigna tareas, controla el flujo y los puntos de control. |
| Implementer | `implementer.md` | Escribe el código según el plan aprobado. |
| Reviewer | `reviewer.md` | Valida el resultado contra los criterios de aceptación. **No corrige, reporta.** |

Los ficheros viven en `.pi/agents/` y están registrados como plantillas de
prompt en `.pi/settings.json`, así que en Pi se invocan como comandos:
`/planner`, `/coordinator`, `/implementer` y `/reviewer`.
El trabajo se apoya en el flujo de specs de `specs/` (spec.md → plan.md →
tasks.md), described en `specs/README.md`.

## 3. Flujo de trabajo obligatorio
Solicitud → PLANNER (plan) → COORDINATOR (asigna) → IMPLEMENTER (código)
→ REVIEWER (veredicto) → COORDINATOR (cierra o reabre)

1. **Ningún cambio de código sin plan del Planner.**
2. **El Implementer no empieza hasta que el Coordinator le pase la tarea concreta.**
3. **El Implementer no termina hasta que el Reviewer apruebe.**
4. Si el Reviewer rechaza, el Coordinator reabre la tarea con el informe
   de fallos y vuelve al paso 3. Máximo **3 ciclos** de rechazo; si se
   agotan, escalar al usuario con el informe completo.
5. El Coordinator es el **único** que actualiza `MEMORY.md` al cerrar tareas.
## 4. Estado y memoria (común a todos)
- Al empezar, **lee `MEMORY.md`** para conocer el estado del proyecto y
  las decisiones tomadas.
- `MEMORY.md` es breve (máx. ~50 líneas): estado actual, decisiones
  importantes (con su porqué) y errores a evitar.
- Si algo se convierte en regla permanente, se mueve a este `AGENTS.md`
  en lugar de quedarse en la memoria.
- **Nunca guardar datos sensibles** (claves, tokens, credenciales, datos
  personales). Las credenciales de BD están en `@credencial.yaml`.
## 5. Reglas globales (aplican a TODOS los agentes)
Estas son inquebrantables, sin excepción:
1. **Comentarios en el código: siempre en español.**
2. **Textos de la interfaz (UI): siempre en español.**
3. **Estilo visual: retro años 80** — fondo oscuro, acentos neón
   (verde lima, cian, magenta, amarillo), tipografía monoespaciada /
   pixel, bordes pixelados, scanlines si es posible.
4. **Nunca mezclar idiomas en la UI** (debe ser 100 % español).
El detalle técnico de cada capa (stack, formato de datos, BD,
comportamiento del quiz) está en el fichero de cada agente.
## 6. Orden de trabajo sugerido (roadmap)
1. Configurar PostgreSQL + pgvector y crear las tablas (`backend/db.sql`).
2. Implementar la ingesta de PDFs (extracción, chunking, embeddings, insert).
3. Generar las 30 preguntas desde la BD y volcarlas en `quiz.js`.
4. Implementar el frontend (`index.html`, `css/style.css`, `js/app.js`).
5. Validar: comportamiento del quiz + idioma + estilo + Playwright.
El Planner usa este roadmap como referencia para planificar tareas,
adaptándolo al estado real del proyecto que lea en `MEMORY.md`.
## 7. Verificación final (gate de cierre)
Cualquier tarea que toque el quiz o `quiz.js` cierra únicamente si:
- `quizData` tiene **exactamente 30 preguntas** válidas.
- El quiz cumple el comportamiento especificado (ver `reviewer.md` §checklist).
- Todos los textos visibles están en español y el estilo es retro 80s.
- `npx playwright test` pasa todas las pruebas
  (Chromium desde `~/.cache/ms-playwright/chromium-1248/`).
