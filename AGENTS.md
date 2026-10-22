# AGENTS.md — Orquestación de agentes (Pi)

## 1. Propósito del proyecto
Aplicación web que crea una base de datos vectorial a partir de PDFs
complejos y genera un **quiz de 30 preguntas** servido con
`quizlib.min.js`, estilo **retro-futurismo de los años 50 (Fallout)**.
Flujo: PDFs → extracción + chunking + embeddings (local, Ollama) →
PostgreSQL + pgvector → 30 preguntas → quiz web (HTML/CSS/JS).

## 2. Sistema de agentes
Este proyecto se desarrolla con **6 agentes**. Cada uno tiene su fichero
de instrucciones; **todos deben leer este `AGENTS.md` primero** y solo
luego el suyo propio.
| Agente | Fichero | Responsabilidad |
|---|---|---|
| Planner | `planner.md` | Descompone el trabajo en tareas y criterios de aceptación. **No escribe código.** |
| Coordinator | `coordinator.md` | Asigna tareas, controla el flujo y los puntos de control. |
| Implementer | `implementer.md` | Escribe el código según el plan aprobado. |
| Reviewer | `reviewer.md` | Valida el resultado contra los criterios de aceptación. **No corrige, reporta.** |
| Graphic Designer | `graphic-designer.md` | Rediseña **solo `css/style.css`** con la estética Fallout. No toca HTML ni JS. |
| Reviewer de estilo | `reviewer-estilo-fallout.md` | Revisa el CSS con los gates 0‑4 (integridad, regresión, estética, accesibilidad, limpieza). **No corrige, reporta.** |

Los ficheros viven en `.pi/agents/` y están registrados como plantillas de
prompt en `.pi/settings.json`, así que en Pi se invocan como comandos:
`/planner`, `/coordinator`, `/implementer`, `/reviewer`,
`/graphic-designer` y `/reviewer-estilo-fallout`.
El trabajo se apoya en el flujo de specs de `specs/` (spec.md → plan.md →
tasks.md), descrito en `specs/README.md`.

## 3. Flujo de trabajo obligatorio
Solicitud → PLANNER (plan) → COORDINATOR (asigna) → IMPLEMENTER (código)
→ REVIEWER (veredicto) → COORDINATOR (cierra o reabre)

Rama visual (cambios de estilo):
COORDINATOR → GRAPHIC DESIGNER (`css/style.css`) → REVIEWER DE ESTILO
(veredicto) → COORDINATOR (cierra o reabre)

1. **Ningún cambio de código sin plan del Planner.**
2. **El Implementer no empieza hasta que el Coordinator le pase la tarea concreta.**
3. **El Implementer no termina hasta que el Reviewer apruebe.**
4. Si el Reviewer rechaza, el Coordinator reabre la tarea con el informe
   de fallos y vuelve al paso 3. Máximo **3 ciclos** de rechazo; si se
   agotan, escalar al usuario con el informe completo.
5. El Coordinator es el **único** que actualiza `MEMORY.md` al cerrar tareas.
6. Un cambio de **estilo visual** lo hace el Graphic Designer y lo valida el
   Reviewer de estilo. El Reviewer general no juzga el CSS y el Reviewer de
   estilo no juzga la lógica: cada uno en su lane.

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
3. **Estilo visual: retro-futurismo de los años 50 (Fallout)** — fondo
   marrón carbón, paneles con borde doble y esquinas de 4‑8 px, azul Vault
   Boy en acentos y barra de progreso, naranja/amarillo en botones y
   títulos, verde y rojo en los estados, texto crema sobre oscuro. Tipografías
   **locales** (Anton para títulos, Oswald para rótulos, Courier Prime para
   el cuerpo, VT323 para el terminal). Nada de neón lima/cian/magenta: ese
   era el estilo anterior (spec 003) y ya no manda.
4. **Nunca mezclar idiomas en la UI** (debe ser 100 % español).
5. **El juego funciona sin red**: ni fuentes ni imágenes remotas. Los
   ficheros de fuente van en `css/fuentes/` con su licencia OFL.
6. **Los estados de acierto y fallo nunca se comunican solo con color**:
   van siempre acompañados de borde, fondo o icono.
7. **El sonido tampoco es el único canal**: refuerza, no informa. Siempre
   hay un control de sonido visible con el estado escrito
   (`SONIDO: SÍ`/`SONIDO: NO`), atajo `M` y `aria-pressed`. Nada suena
   antes del primer gesto del jugador, el sonido se recuerda entre
   visitas (`localStorage`) y **no hay música ni bucle de fondo**.
8. **El audio se sintetiza** con Web Audio (`js/audio.js`): nada de
   ficheros de audio, ni binarios, ni licencias nuevas, para no romper la
   regla de funcionar sin red.
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
- Todos los textos visibles están en español y el estilo es el Fallout/50s.
- `npx playwright test` pasa todas las pruebas
  (Chromium desde `~/.cache/ms-playwright/chromium-1248/`).

Cualquier tarea que toque el sonido cierra únicamente si:
- Se pide **un solo efecto por acción** (comprobado con los contadores de
  `window.OPOQUIZ_AUDIO`, no a oído).
- No se crea contexto de audio antes del primer gesto del jugador.
- Con el sonido apagado no se reproduce nada y la preferencia se recuerda.
- Sin `AudioContext` la partida se juega igual y sin errores de consola.
- El control de sonido cumple AA y está en español.

Cualquier tarea que toque `css/style.css` cierra únicamente si:
- El Reviewer de estilo emite **VEREDICTO: APROBADO** (gates 0‑4).
- El contraste del texto es **AA (4.5:1)** como mínimo, medido en el
  navegador, no estimado.
- Hay al menos **4 capturas** revisadas (inicio, acierto, fallo, final) en
  escritorio (1280 px) y móvil (360 px).
- `npx playwright test` sigue en verde.
