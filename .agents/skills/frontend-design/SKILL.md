---
name: frontend-design
description: Guía de diseño visual para OPOQUIZ (quiz retro-futurista de los años 50 sobre Administración Pública). Aporta criterio para construir o retocar interfaces con estética Fallout, tipografías locales, paleta de vault y Pixel Art, sin recurrir a frameworks ni librerías CSS modernas. Úsala al crear o modificar index.html, css/style.css o js/app.js.
license: Complete terms in LICENSE.txt.
---

# Diseño frontend en OPOQUIZ

Adaptación de la skill `frontend-design` de Anthropic al proyecto OPOQUIZ.
La versión original está en `UPSTREAM.md` (consulta solo como referencia de
metodología; este fichero es el que manda).

## 0. Prioridad de las reglas

1. **La sección 5 de `AGENTS.md` es inquebrantable**: comentarios y textos de
   interfaz en español, estética **retro-futurismo de los años 50 (Fallout)**,
   sin frameworks ni librerías CSS modernas.
2. Esta skill **no sustituye** esas reglas: las hace aplicables. Cuando una
   recomendación genérica de la skill original contradiga el estilo Fallout,
   gana el Fallout.
3. Todo el frontend es **HTML + CSS + JS vanilla + `js/quizlib.min.js`**. Nada
   de React, Tailwind ni Bootstrap. **El juego funciona sin red**: ni fuentes
   remotas ni imágenes externas.

## 1. El asunto: qué es OPOQUIZ

Antes de tocar una pantalla, ten claro el sujeto y para quién es:

- **Qué es**: un banco de 30 preguntas tipo test sobre Administración Pública
  española (Constitución, Cortes, Gobierno, TREBEP, igualdad, datos personales,
  administración electrónica), generadas a partir de PDF indexados en
  PostgreSQL + pgvector.
- **Quién**: aspiring a oposición que estudia y quiere comprobar si se sabe la
  materia. Usa el quiz en el móvil o en el portátil, en ratos cortos, a menudo
  con prisas.
- **Su trabajo principal**: responder 30 preguntas, ver si ha acertado y leer
  la explicación. Todo lo demás es decorado y no debe estorbar.
- **El material y el lenguaje**: la interfaz es el **panel de control de un
  vault de los años 50**: cartón beige‑marrón, menús naranja, marcador
  azul de Vault Boy, rótulos de terminal en verde pixelado. Ese es el motivo
  por el que la interfaz **es** lo que es: no es un adorno, es el concepto.

## 2. La casa: tokens obligatorios

Los tokens ya existen en `css/style.css` (bloque `:root`). Reúsalos; no
introduzcas colores sueltos ni reescribas la paleta.

| Token | Valor | Uso |
|---|---|---|
| `--fondo` | `#1a1714` | Fondo (marrón carbón) |
| `--fondo-panel` | `#2e2820` | Paneles y tarjetas |
| `--borde-panel` | `#4a4034` | Borde exterior de los paneles |
| `--azul` / `--azul-claro` | `#2f7fd4` / `#4aa3e8` | Acentos Vault Boy, progreso, botones secundarios |
| `--naranja` / `--naranja-oscuro` | `#f2a900` / `#e08b1d` | Botones primarios y títulos |
| `--verde` / `--verde-texto` | `#7ec850` / `#9ada6a` | Respuesta correcta |
| `--rojo` / `--rojo-texto` | `#d0433a` / `#ef7a6f` | Respuesta incorrecta |
| `--texto` / `--texto-tenue` | `#e8dcc8` / `#a89880` | Texto principal y secundario |
| `--fuente-cartel` | Anton | Títulos |
| `--fuente-rotulo` | Oswald | Rótulos y botones |
| `--fuente-cuerpo` | Courier Prime | Enunciados y explicaciones |
| `--fuente-terminal` | VT323 | Detalles "terminal" |

Reglas de casa (heredadas de `AGENTS.md`):

- Fondo oscuro y cálido, siempre. Nunca fondo crema ni claro.
- Acentos: **azul Vault Boy y naranja de menú**. Nada de neón lima, cian ni
  magenta: ese era el estilo anterior (spec 003) y ya no manda.
- **Cuatro familias tipográficas**, todas locales en `css/fuentes/`:
  cartel (títulos), rótulo (etiquetas y botones), cuerpo (texto largo) y
  terminal (detalles pixelados). No añadas una quinta.
- Bordes: grosor de 2‑3 px, esquinas de 4‑8 px (nunca 0, nunca muy
  redondeadas), y **doble borde** en los paneles (grueso oscuro + línea fina
  interior).
- Texturas solo con `background` y gradientes: grano de película, viñeta y
  scanlines. **Ninguna imagen externa**.
- Sombras duras, nunca difusas estilo SaaS.

## 3. Principios de diseño (adaptados)

### La tipografía lleva la personalidad

- **Escala**: títulos grandes en cartel con `letter-spacing` amplio (4‑7 px);
  enunciados de pregunta en 1.05 rem; rótulos de estado en VT323.
- **Longitud de línea**: en este proyecto manda la legibilidad de un enunciado
  largo; usa `max-width` de 60‑75 caracteres y `line-height` 1.5‑1.7.
- **Alineación**: a la **izquierda** para enunciados y opciones; centrado solo
  para la pantalla de bienvenida, la puntuación final y el pie.
- El tratamiento tipográfico debe ser parte del diseño, no un vehículo neutro.

### La estructura visual es información

- Bordes, paneles y la barra de progreso **encuadran** el contenido: separan
  estados (pendiente / respondida / correcta) y no decoran.
- La barra de progreso es un indicador literal (segmentos con brillo azul).
- **No uses mayúsculas decorativas fuera de donde el estilo las pide**: sí en
  títulos de pantalla, rótulos de estado (`> EXPLICACIÓN`) y botones; **no** en
  el enunciado de la pregunta ni en las opciones (son texto que se lee, no
  cromo).
- **No** numeres los elementos (`01 / 02 / 03`) salvo que la secuencia sea
  real: la numeración solo aparece en `PREGUNTA 7 / 30`.

### Movimiento

- El movimiento se usa con lupa: transiciones de 120‑200 ms en hover y focus,
  y el avance de la barra de progreso escalonado.
- **Respeta `prefers-reduced-motion`**: envuelve transiciones y brillos en
  una media query que los desactive. Es requisito de accesibilidad.
- Cada hover y cada foco debe devolver información ("estás aquí"), nunca
  "hover por decoración".

### Contenido real

- Los textos de la interfaz van **en español** y explican lo que ocurre:
  `> EXPLICACIÓN`, `PREGUNTA 7 / 30`, `FIN DE LA PARTIDA`.
- Usa el vocabulario del dominio: "opción", "pregunta", "aciertos", "partida".
  Nada de "enviar", "continuar", "check", "score".
- Tono directo, voz activa, una tarea por elemento. Sin relleno ni emojis.

## 4. Proceso: planificar, revisar, construir, criticar

1. **Planifica** antes de escribir código. Para una pantalla nueva o un retoque
   grande, escribe un plan breve con:
   - **Color**: qué tokens de `:root` se usan y con qué jerarquía.
   - **Tipo**: tamaños, pesos y espaciados concretos.
   - **Layout**: esbozo ASCII de la estructura y criterio de alineación.
   - **Principios**: qué hace que esa pantalla sea "de los 50" y no una más.
2. **Revisa** el plan contra el brief (aquí, contra `AGENTS.md` y el estilo
   Fallout ya existente en `css/style.css`). Si una parte del plan podría
   aplicarse tal cual a cualquier otra web, revísala: en este proyecto, ese es
   el signo de que has caído en el default.
3. **Construye** respetando la estructura existente: `index.html` con la
   jerarquía de pantallas, `css/style.css` con los tokens, `js/app.js` con la
   lógica. No añadas librerías.
4. **Critica tu propio trabajo**: haz capturas con Playwright
   (`npx playwright test` y el MCP de Playwright) y revísalas. Una captura
   vale más que mil tokens.

## 5. Errores frecuentes en este proyecto

- Introducir un framework, un CDN o una fuente remota.
- Poner mayúsculas o etiquetas decorativas en el enunciado y las opciones.
- Usar sombras difusas o degradados "modernos" fuera de los botones.
- Salirse de la paleta: tonos fríos, grises apagados o acentos nuevos.
- Poner texto en inglés en la interfaz o en los comentarios.
- **Marcar en verde la respuesta correcta de una pregunta que aún no se ha
  contestado**: solo las preguntas respondidas llevan color (verde la
  correcta, roja la fallada elegida). Es un fallo funcional, no de estilo.
- **Comunicar el acierto o el fallo solo con color**: siempre van con borde,
  fondo o icono.
- Romper el layout responsive: a 360 px de ancho las opciones deben seguir
  leyéndose y sin desbordar.
- Dejar la interfaz sin foco visible: botones y opciones necesitan
  `:focus-visible` con contorno claro.

## 6. Comprobaciones antes de dar por terminado

- [ ] `npx playwright test` en verde (incluye la prueba de que las preguntas
      sin contestar no muestran ningún color).
- [ ] Capturas revisadas: pantalla de inicio, pregunta contestada y pantalla
      final, en móvil (360 px) y escritorio (1280 px).
- [ ] Contraste AA **medido** en el navegador (4.5:1 en texto normal).
- [ ] Todo el texto visible en español.
- [ ] Solo se usan tokens de `:root` y las clases ya existentes.
- [ ] Sin librerías ni fuentes remotas; foco visible y
      `prefers-reduced-motion` respetado.
