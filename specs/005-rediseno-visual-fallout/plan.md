# Plan — Rediseño visual Fallout (spec 005)

## 1. Enfoque

Un único fichero de estilos cambia por completo: `css/style.css` (1.040
líneas). El HTML y el JavaScript **no se tocan**, así que el riesgo no está
en el comportamiento sino en:

1. **Regresión visual**: que un selector mal traducido rompa la
   legibilidad, el foco o el contraste.
2. **Pérdida de selectores**: el CSS actual define reglas para clases que
   el DOM sí tiene; si el rediseño las omite, elementos quedan sin estilo.
3. **Regresión funcional**: que las 35 pruebas de Playwright y las 35
   unitarias dejen de pasar.

Por eso el trabajo va precedido de una fase de preparación que deja el
entorno listo para que el cambio de paleta no rompa la suite.

## 2. Fases

### Fase 1 — Preparación (sin tocar el estilo)

| Tarea | Qué | Quién |
|---|---|---|
| P1 | Descargar las 4 fuentes (Anton, Oswald, VT323, Courier Prime) a `css/fuentes/` con sus licencias OFL | Implementer |
| P2 | Desacoplar `tests/quiz.spec.js` de la paleta: leer `--verde`/`--rojo` del CSS en vez de literales | Implementer |
| P3 | Capturas "antes" (inicio, acierto, fallo, final) para comparar | Reviewer |

### Fase 2 — Rediseño

| Tarea | Qué | Quién |
|---|---|---|
| D1 | Reescribir `css/style.css` con la identidad Fallout | Graphic Designer |
| D2 | Revisar con los gates 0‑4 y emitir veredicto | Reviewer de estilo Fallout |

### Fase 3 — Cierre

| Tarea | Qué | Quién |
|---|---|---|
| C1 | Actualizar `AGENTS.md` (§2 agentes, §3 flujo, §5 estilo, §7 gate visual) | Coordinator |
| C2 | Reescribir la skill `.agents/skills/frontend-design/SKILL.md` | Implementer |
| C3 | Actualizar `README.md` y `MEMORY.md` | Coordinator |
| C4 | Suite completa + capturas "después" + commit | Coordinator |

## 3. Reglas para el Graphic Designer

- Solo `css/style.css`. Si necesita un elemento que no existe, lo anota
  en el entregable en vez de tocar el HTML.
- **Lista negra de selectores** (semánticos, no se renombran ni se eliminan):
  `.opcion`, `.opcion.respondida`, `.opcion.quizlib-correct`,
  `.opcion.quizlib-incorrect`, `.opcion input`, `.correcta`, `.elegida`,
  `.revision-pregunta[data-resultado="acierto"]`,
  `.revision-pregunta[data-resultado="fallo"]`, `.revision-opcion.correcta`,
  `.revision-opcion.elegida`, `.partida-aciertos`, `.partida-fallos`,
  `.oculto`, `.scanlines`, `.progreso-relleno`, `.progreso-marcador`.
- **Conservar**: `prefers-reduced-motion`, `:focus-visible` en botones y
  opciones, el comportamiento responsive a 360 px, el layout de una pregunta
  a la vez.
- **Paleta en `:root`** con los nombres `--verde` y `--rojo` (los usa la
  suite de tests).
- Halos derivados de variables, sin RGBA literales repetidos.

## 4. Riesgos

| Riesgo | Mitigación |
|---|---|
| El test de colores falla con la paleta nueva | P2 lo desacopla antes de tocar el estilo |
| El juego deja de funcionar sin red | Las fuentes van locales; no hay `url()` a imágenes |
| El estilo nuevo convive con retales del viejo | Gate 4 del revisor: paleta en variables, sin hex sueltos |
| Otro agente "arregla" el estilo de vuelta a neón | C1 y C2 actualizan `AGENTS.md` y la skill |

## 5. Verificación

```bash
npx playwright test              # 35 pruebas
.venv/bin/python backend/test_pool.py    # 35 pruebas
.venv/bin/python backend/verificar_pool.py
```

Además, capturas en escritorio (1280 px) y móvil (360 px) de: inicio,
pregunta acertada, pregunta fallada, pantalla final y modal de revisión.
