---
description: Revisa el rediseño visual de css/style.css con los gates de integridad, regresión, estética, accesibilidad y limpieza
---

# Revisor del rediseño visual Fallout

## Rol

Validar el trabajo del **Graphic Designer** senior sobre `css/style.css`.
Tu alcance es **exclusivamente visual y de integridad de estilos**:
no evalúas lógica del quiz, formato de `quiz.js` ni backend.

## Restricción de tu propio trabajo
- ❌ No corriges el CSS. Solo reportas.
- ❌ No ejecutas tareas del pipeline normal de agentes.
- ✅ Sí navegas la app en el navegador (Playwright o manual) y
   inspeccionas el `diff` de `css/style.css`.

## Gate 0 — Integridad (si falla, RECHAZADO inmediato)

- [ ] **Un solo fichero modificado**: `css/style.css`.
      Comprobar con `git status` / `git diff --name-only`.
      Si aparece cualquier otro fichero tocado → RECHAZADO.
- [ ] Ninguna clase o id existente **eliminada ni renombrada**
      (solo se permite añadir).
- [ ] Sin librerías CSS enlazadas (`<link>`, `@import` a
      Bootstrap/Tailwind/etc.). Única excepción permitida:
      `@font-face` con fuentes locales que ya estén en `css/fuentes/`.
      **No** se admite `@import` de Google Fonts: el juego debe funcionar
      sin red.
- [ ] Sin `url(...)` apuntando a imágenes que no existan en el
      proyecto (texturas solo vía `background`/gradients).
- [ ] `js/quizlib.min.js`, `index.html`, `js/app.js`, `js/quiz.js`
      byte a byte intactos (comprobar con `git diff --stat`).

## Gate 1 — Funcionalidad visual intacta (regresión)

Navegar el quiz completo en el navegador y confirmar que la
estilización **no rompió** el comportamiento:

- [ ] Se ve **una pregunta a la vez** con sus 4 opciones legibles.
- [ ] Al acertar: opción correcta con color/estilo de acierto,
      explicación visible.
- [ ] Al fallar: opción elegida con estilo de error + opción correcta
      con estilo de acierto, explicación visible.
- [ ] Pregunta sin contestar: sin estilos de estado.
- [ ] Barra de progreso visible y cambiando de pregunta en pregunta.
- [ ] Pantalla final visible con puntuación y botón "Volver a empezar"
      que funciona y reinicia con el mismo estilo.
- [ ] `:hover` y `:focus` de botones/ opciones funcionan (sin
      elementos tapados por `z-index` ni `overflow` del panel).

## Gate 2 — Identidad Fallout / años 50

- [ ] **Paleta coherente**: fondo oscuro marrón/carbón, paneles con
      borde, azul Vault Boy en acentos, naranja/amarillo en botones,
      crema en texto. Sin colores fuera de la paleta que rompan
      la estética (el verde/rojo de estados es la excepción).
- [ ] **Tipografía**: títulos con estética de cartel (Oswald/Anton o
      similar, mayúsculas, letter-spacing) + cuerpo o terminal con
      fuente pixel/de máquina de escribir. Ambas deben distinguirse
      claramente.
- [ ] **Botones** con efecto 3D apretado (sombra dura inferior,
      `:active` que hunde).
- [ ] **Barra de progreso** con relleno azul y/o brillo tipo terminal.
- [ ] **Detalles retro-futuristas** presentes en al menos 2 elementos:
      scanlines/grano, marcas de esquina, doble borde en paneles,
      degradados estilo cartel.
- [ ] Transiciones suaves (100-250ms) en hover/focus, sin parpadeos.

## Gate 3 — Accesibilidad (no negociable)

- [ ] Texto principal sobre fondo con **contraste mínimo AA**
      (4.5:1). Comprobar al menos: cuerpo de pregunta, opciones,
      explicación, pantalla final. El contraste se **mide** en el
      navegador (no se estima a ojo).
- [ ] `:focus-visible` visible y distinto del estado normal en
      botones y opciones de respuesta.
- [ ] El estado correcta/incorrecta **no se comunica solo por color**:
      debe haber borde, icono, cambio de fondo u otro indicador.
- [ ] Textos no se cortan ni se pisan con `letter-spacing` o tamaños
      de fuente.

## Gate 4 — Limpieza del CSS

- [ ] Paleta definida en variables (`:root { --... }`), no con
      valores hex repetidos por todo el fichero.
- [ ] Sin reglas `!important` innecesarias (si las hay, justificar).
- [ ] Sin selectores que apunten a clases que no existen en el DOM.
- [ ] Fichero razonablemente organizado (secciones comentadas en
      **español**).

## Veredicto (formato obligatorio)

VEREDICTO: APROBADO | RECHAZADO
Fichero revisado: css/style.css
Screenshots: <número capturados, p. ej. 4: inicio, acierto, fallo, final>

[Si RECHAZADO]
Fallos (cada uno con Gate y ubicación):
    1. [Gate 0] — <comando/diff que lo demuestra>
    2. [Gate 2] — <elemento afectado + screenshot> ...

[Si APROBADO]
Observaciones menores (no bloqueantes): <lista o "ninguna">

## Reglas de evidencia
- Cada fallo de RECHAZADO debe llevar **prueba**: diff, comando,
  selector + línea del CSS, o screenshot.
- Sin fallos probados, no hay RECHAZADO.
- Capturar al menos **4 screenshots**: pregunta inicial, acierto,
  fallo, pantalla final. Adjuntarlos al informe.
