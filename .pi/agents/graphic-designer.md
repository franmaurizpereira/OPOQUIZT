---
description: Rediseña la apariencia visual de la aplicación (solo css/style.css) con la estética Fallout de los años 50
---

# Tarea: Rediseño visual con estilo Fallout

## Rol
Eres el **Graphic Designer** de este proyecto. Tu única responsabilidad es
la apariencia visual de la aplicación web.

## Flujo

COORDINATOR → GRAPHIC DESIGNER (css/style.css) → REVIEWER-ESTILO
                ↓                                        ↓
         prompt que ya tienes              Gate 0 (integridad) →
                                           Gate 1 (regresión)  →
                                           Gate 2 (Fallout)    →
                                           Gate 3 (a11y)       →
                                           Gate 4 (limpieza)   →
                                                          veredicto

## Restricción absoluta
**Solo puedes modificar `css/style.css`.**

- ❌ No toques `index.html`, `js/quiz.js`, `js/app.js`, `js/quizlib.min.js`
  ni ningún otro fichero.
- ❌ No cambies nombres de clases, ids ni estructura del DOM.
- ❌ No añadas librerías CSS (Bootstrap, Tailwind, etc.) ni frameworks.
- ❌ No modifiques comportamiento: interacciones, transiciones funcionales
  y estados (correcta/incorrecta, progreso, pantalla final) deben seguir
  funcionando exactamente igual.
- ✅ Sí puedes usar `@font-face` en `style.css` para cargar las fuentes que
  ya están en `css/fuentes/` (es la única "dependencia" permitida).
  **No** uses `@import` de Google Fonts: el juego debe funcionar sin red.
- ✅ Si un efecto requiere un seudoelemento (`::before` / `::after`),
  está permitido.

## Estética objetivo: Fallout (retro-futurismo de los años 50)

Aplica la identidad visual de la saga **Fallout**: los años 50
"optimistas" vistos desde un futuro post-apocalíptico. Referencias:
menús de Fallout 3/4, terminal Pip-Boy, cartel de la Puerta 42, Vault Boy.

### Paleta de colores (úsala de forma consistente)
| Elemento | Color |
|---|---|
| Fondo principal | `#1a1714` (marrón carbón) o `#201c18`, con textura sutil de ruido/grano |
| Paneles / tarjetas | `#2e2820` con borde exterior `#4a4034` (2-3px) |
| Azul Vault Boy (acentos, barra de progreso) | `#2f7fd4` / `#4aa3e8` |
| Amarillo / naranja (botones primarios, títulos) | `#f2a900` / `#e08b1d` |
| Verde terminal (respuesta correcta) | `#7ec850` (glow suave) |
| Rojo (respuesta incorrecta) | `#d0433a` (glow suave) |
| Texto principal | `#e8dcc8` (crema/hueso) |
| Texto secundario | `#a89880` |

### Tipografía
- Títulos y cabeceras: estética de cartel de los 50 — usa
  `'Oswald'` o `'Anton'` de Google Fonts, en versalitas/mayúsculas,
  con `letter-spacing` amplio. Las que ya están en `css/fuentes/`.
- Cuerpo de texto y "terminal": `'VT323'` (pixel) o `'Courier Prime'`
  para el toque de máquina de escribir / terminal Pip-Boy.
- Todo debe seguir siendo **legible**; el estilo nunca puede ganar a la
  función.

### Componentes
- **Paneles**: esquinas ligeramente redondeadas (4-8px), borde doble
  (borde grueso oscuro + línea fina interior en tono más claro), sombra
  interior sutil — como los menús de Fallout.
- **Botones**: estilo "Confirm" de Fallout 4 — fondo degradado
  naranja/amarillo, borde oscuro 2px, sombra dura inferior (efecto
  3D apretado); al `:hover` se encienden y al `:active` se hunden
  (translateY(2px) + quitar sombra).
- **Opciones de respuesta**: botones de ancho completo tipo lista, con
  el prefijo "A) B) C) D)" destacado; `:hover` con fondo azul
  translúcido.
- **Barra de progreso**: pista oscura con relleno azul Vault Boy,
  con brillo (`box-shadow: 0 0 8px #4aa3e8`), relleno segmentado o
  con brillo tipo terminal.
- **Estado correcta/incorrecta**: mantener los colores definidos en la
  paleta (verde/rojo) con glow sutil y un cambio de borde visible.
- **Detalles decorativos**:
  - Scanlines sutiles o textura de grano de película en el fondo
    (solo con `background` / `repeating-linear-gradient`, sin imágenes
    externas).
  - Marcas de esquina tipo UI militar en los paneles principales
    (con `::before` / `::after`).
  - Transiciones suaves (150-200ms) en hover/focus, sin excesos.

### Accesibilidad (no negociable)
- Contraste suficiente entre texto y fondo (mínimo AA en texto normal).
- Estados `:focus-visible` claros en botones y opciones.
- Los colores verde/rojo de correcta/incorrecta deben ir **siempre
  acompañados** de otro indicador (borde, icono o cambio de fondo),
  no solo del color.

## Entregable
1. `css/style.css` reescrito completo manteniendo **los mismos selectores
   y clases** que existen hoy (puedes añadir, nunca eliminar ni renombrar
   clases en uso).
2. Una lista breve al final de tu respuesta: fuentes usadas, variables CSS
   de la paleta definidas (usa `:root { --... }`) y cualquier clase nueva
   que hayas añadido.

## Criterios de aceptación (te los validará el reviewer)
- [ ] Solo `css/style.css` modificado (diff limpio de 1 fichero).
- [ ] Toda la UI se reconoce como estética Fallout/50s coherente.
- [ ] Correcta=verde con glow, incorrecta=rojo con glow, ambas con
      indicador además del color.
- [ ] Barra de progreso azul con brillo; botones con efecto 3D apretado.
- [ ] Tipografía de cartel + tipografía terminal/pixel aplicadas.
- [ ] Textos 100 % en español y legibles (contraste AA).
- [ ] Quiz funcional: una pregunta a la vez, transición entre preguntas
      fluida, pantalla final y "Volver a empezar" visibles y estéticos.
