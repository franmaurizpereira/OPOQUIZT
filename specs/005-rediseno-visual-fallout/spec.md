# Spec 005 — Rediseño visual con estilo Fallout (años 50)

## 1. Objetivo

Cambiar por completo la dirección de arte de OPOQUIZ: de la estética
"terminal CRT de los años 80" (fondo negro, neón lima/cian/magenta) a la
**estética Fallout**, es decir, retro-futurismo de los años 50 visto desde
un futuro post-apocalíptico: cartón beige‑marrón, azul Vault Boy, naranja
de los menús de los vaults, tipografía de cartel de los 50 y de terminal
Pip‑Boy.

El cambio afecta a **toda** la aplicación: pantalla de inicio, pantalla del
quiz, pantalla final, historial y ventana modal de revisión.

## 2. Decisiones del usuario (2026-10-22)

1. **Sí** se cambia la dirección de arte oficial del proyecto. La regla
   `AGENTS.md` §5.3 pasa de "retro 80s neón" a "retro-futurismo años 50
   (Fallout)".
2. **Las fuentes se descargan al repositorio** (`css/fuentes/*.woff2`), no se
   enlazan con `@import` de Google Fonts. Motivo: el juego debe seguir
   funcionando **sin red** (requisito de la spec 003).
3. El rediseño aplica a **todo** el diseño, no a una parte.

## 3. Requisitos funcionales

- **RF1**: el juego conserva exactamente su comportamiento actual: una
  pregunta a la vez, 4 opciones, paso a la siguiente, barra de progreso, pantalla
  final con puntuación, "volver a empezar", historial y modal de revisión.
- **RF2**: ninguna clase, id, texto ni estructura del DOM cambia. Solo cambia
  `css/style.css` (más las fuentes y la documentación).
- **RF3**: la paleta, tipografías, botones, paneles, barra de progreso y
  estados de acierto/fallo cumplen la identidad Fallout definida abajo.
- **RF4**: los estados correcta/incorrecta se comunican **con color y con
  otro indicador** (borde, icono o cambio de fondo), nunca solo con color.
- **RF5**: contraste mínimo AA en todo el texto visible y `:focus-visible`
  claramente distinguible.
- **RF6**: se respeta `prefers-reduced-motion`.
- **RF7**: el juego funciona **sin red**: no hay peticiones a fuentes externas
  ni a imágenes externas.
- **RF8**: los textos visibles de la interfaz siguen siendo **100 % en
  español** y los comentarios del CSS, en español.

## 4. Dirección de arte

### 4.1 Paleta (variables CSS)

| Variable | Valor | Uso |
|---|---|---|
| `--fondo` | `#1a1714` | Fondo principal (marrón carbón) |
| `--fondo-panel` | `#2e2820` | Paneles y tarjetas |
| `--borde-panel` | `#4a4034` | Borde exterior de los paneles |
| `--azul` | `#2f7fd4` | Acentos Vault Boy, barra de progreso |
| `--azul-claro` | `#4aa3e8` | Brillos y hover |
| `--naranja` | `#f2a900` | Botones primarios y títulos |
| `--naranja-oscuro` | `#e08b1d` | Degradados y bordes de botón |
| `--verde` | `#7ec850` | Respuesta correcta |
| `--rojo` | `#d0433a` | Respuesta incorrecta |
| `--texto` | `#e8dcc8` | Texto principal (crema/hueso) |
| `--texto-tenue` | `#a89880` | Texto secundario |

Los halos (`text-shadow`/`box-shadow`) se derivan de estas variables; no se
admiten valores RGBA literales repetidos (Gate 4 del revisor de estilo).

### 4.2 Tipografías (locales)

- `Anton` → títulos y cabeceras (cartel de los 50, mayúsculas, `letter-spacing`
  amplio).
- `Oswald` → subtítulos, etiquetas y botones.
- `Courier Prime` → cuerpo de texto (enunciados, opciones, explicaciones):
  legible en bloques largos.
- `VT323` → rótulos de estado y detalles "terminal" (`> EXPLICACIÓN`).

### 4.3 Componentes

- **Paneles**: esquinas de 4‑8 px, borde doble (grueso oscuro + línea fina
  interior), sombra interior sutil, marcas de esquina tipo UI militar.
- **Botones**: fondo degradado naranja/amarillo, borde oscuro de 2 px, sombra
  dura inferior; al `:hover` se encienden, al `:active` se hunden
  (`translateY(2px)`).
- **Opciones**: ancho completo, prefijo "A) B) C) D)" destacado, `:hover` con
  fondo azul translúcido.
- **Barra de progreso**: pista oscura, relleno azul con brillo
  (`box-shadow: 0 0 8px #4aa3e8`).
- **Fondo**: grano/scanlines sutiles con `repeating-linear-gradient`, sin
  imágenes externas.

## 5. Criterios de aceptación

- [ ] `css/style.css` reescrito: solo se modifican estilos, ninguna clase ni
      id existente se elimina o renombra.
- [ ] Los ficheros `index.html`, `js/app.js`, `js/quiz.js` y
      `js/quizlib.min.js` están intactos.
- [ ] Las 4 fuentes están en `css/fuentes/` con su licencia OFL y se cargan
      con `@font-face` local (sin peticiones a internet).
- [ ] `npx playwright test` pasa (35 pruebas) y `backend/test_pool.py` pasa
      (35 pruebas).
- [ ] `backend/verificar_pool.py` sigue diciendo que el pool es válido (el
      rediseño no toca el pool).
- [ ] Capturas revisadas: inicio, acierto, fallo, final y modal de revisión,
      en escritorio (1280 px) y móvil (360 px).
- [ ] Todo el texto visible en español.
- [ ] Contraste AA y `:focus-visible` visibles.

## 6. Fuera de alcance

- Cambiar textos de la interfaz, el contenido del pool o el modelo de datos.
- Tocar `js/quizlib.min.js` o cualquier JavaScript.
- Añadir animaciones que superen 200 ms o que parpadeen.

## 7. Agentes implications

- Se añaden dos agentes al flujo: **Graphic Designer** (`.pi/agents/
  graphic-designer.md`) y **Reviewer de estilo Fallout**
  (`.pi/agents/reviewer-estilo-fallout.md`).
- Flujo visual: COORDINATOR → GRAPHIC DESIGNER → REVIEWER-ESTILO → cierre.
- `AGENTS.md` §2 (tabla de agentes), §3 (flujo) y §5 (reglas globales) se
  actualizan, y §7 (gate de cierre) incluye la verificación visual.
- La skill `.agents/skills/frontend-design/SKILL.md` se reescribe para la
  nueva dirección de arte (si no, cualquier otro agente devolvería el
  estilo a neón).
