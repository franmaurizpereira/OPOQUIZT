# Tasks — Rediseño visual Fallout (spec 005)

**Estado:** completada (P1, P2, P3, D1, D2, C1, C2, C3 y C4 hechas)
**Plan:** `plan.md` (005-rediseno-visual-fallout)

---

## P1: Fuentes locales — ✅ HECHA

**Hecha (2026-10-22)**: descargadas a `css/fuentes/`:

| Fichero | Peso | Tamaño |
|---|---|---|
| `anton-400.woff2` | 400 | 31 KB |
| `oswald-500.woff2` | 500 | 19 KB |
| `oswald-700.woff2` | 700 | 19 KB |
| `vt323-400.woff2` | 400 | 16 KB |
| `courier-prime-400.woff2` | 400 | 13 KB |
| `courier-prime-700.woff2` | 700 | 13 KB |

Licencias OFL en `css/fuentes/OFL-*.txt`. Total 111 KB. El juego sigue
funcionando sin red.

## P2: Test de colores desacoplado de la paleta — ✅ HECHA

**Hecha (2026-10-22)**: `tests/quiz.spec.js` ya no espera `rgb(37, 255, 122)`
ni `rgb(255, 43, 78)`: lee `--verde` y `--rojo` de `:root` y compara con el
color calculado de `.partida-aciertos` y `.partida-fallos`. Así el test
sobrevive a cualquier cambio de paleta.

## P3: Capturas "antes" — ✅ HECHA

**Hecha (2026-10-22)**: capturas de la interfaz con el estilo CRT de los 80
(inicio, pregunta acertada, pregunta fallada, pantalla final y modal de
revisión) en `logs/capturas/antes-*.png`.

---

## D1: Rediseño de `css/style.css` — ✅ HECHA

**Hecho (2026-10-22)**: `css/style.css` reescrito por completo (1.165
líneas). Paleta Fallout en `:root` (fondo `#1a1714`, panel `#2e2820`, azul
Vault Boy, naranja de menú, verde/rojo de terminal, texto crema), cuatro
tipografías locales (`@font-face` a `css/fuentes/`), paneles con borde doble
y marcas de esquina, botones con efecto 3D apretado, barra de progreso azul
con brillo y 30 celdas, cinta de advertencia bajo el título, grano de película
y viñeta. Ninguna clase ni id eliminado o renombrado: el único selector
retirado fue `@keyframes parpadeo`.

## D2: Revisión de estilo — ✅ HECHA

**Hecho (2026-10-22)**: los 5 gates revisados con evidencia.
- **Gate 0**: el diff del rediseño es solo `css/style.css`; comparados los
  124 selectores antiguos con los 121 nuevos, ninguno eliminado ni
  renombrado.
- **Gate 1**: `npx playwright test` → 35/35; partida completa revisada en el
  navegador (una pregunta a la vez, acierto, fallo, progreso, pantalla final,
  "volver a empezar" y modal de revisión).
- **Gate 2**: identidad Fallout coherente en toda la app (inicio, quiz,
  final, historial y revisión); 4 detalles retro-futuristas (grano, marcas de
  esquina, doble borde, cinta de advertencia).
- **Gate 3**: contraste **medido** en el navegador. Se detectaron y corrigieron
  dos fallos: el botón y el filtro azules con texto crema (2,4:1) y el rojo de
  marca sobre el panel (3:1). Ahora el peor par es 4,78:1.
- **Gate 4**: todos los hex y rgba en variables de `:root`; el único
  `!important` es el de `.oculto`, justificado en un comentario.


- **Objetivo**: reescribir `css/style.css` con la identidad Fallout/años 50
  manteniendo todos los selectores en uso.
- **Fichero afectado**: `css/style.css` (y solo ese).
- **Criterios de aceptación**: los de la spec 005 §5 y los gates del
  revisor de estilo.

---

## C1: Actualizar `AGENTS.md` — ✅ HECHA

**Hecha (2026-10-22)**: §2 (6 agentes), §3 (rama visual del flujo), §5
(estilo Fallout, fuentes locales, estados nunca solo con color) y §7 (gate
visual: veredicto del Reviewer de estilo + contraste medido + 4 capturas).


## C2: Reescribir la skill de diseño — ✅ HECHA

**Hecha (2026-10-22)**: `.agents/skills/frontend-design/SKILL.md` reescrita
con la nueva dirección de arte (tokens, tipos de fuente, errores frecuentes
y checklist). Se quitaron las prohibiciones que contradecían el estilo
actual (Google Fonts, `border-radius` nulo, tonos cálidos) y se añadieron las
nuevas (contraste medido, fuentes locales, estados con doble indicador).


## C3: `README.md` y `MEMORY.md` — ✅ HECHA

**Hechos (2026-10-22)**: el README describe el estilo Fallout y la carpeta de
fuentes; el MEMORY actualiza las reglas permanentes y añade las decisiones
del rediseño (fuentes locales, variante clara del color de estado, rama
visual de agentes).


## C4: Verificación final y commit — ✅ HECHA

**Hecha (2026-10-22)**: `npx playwright test` 35/35, `backend/test_pool.py`
35/35, `backend/verificar_pool.py` conforme, `python -m py_compile backend/*.py`
sin errores y sintaxis de JS correcta. Capturas revisadas en escritorio
(1280 px) y móvil (360 px).
