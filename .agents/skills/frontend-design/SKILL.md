---
name: frontend-design
description: Guía de diseño visual para OPOQUIZ (quiz retro de los años 80 sobre Administración Pública). Aporta criterio para construir o retocar interfaces con estética CRT, tipografía monoespaciada, acentos neón y Pixel Art, sin recurrir a frameworks ni librerías CSS modernas. Úsala al crear o modificar index.html, css/style.css o js/app.js.
license: Complete terms in LICENSE.txt
---

# Diseño frontend en OPOQUIZ

Adaptación de la skill `frontend-design` de Anthropic al proyecto OPOQUIZ. La
versión original está en `UPSTREAM.md` (consulta solo como referencia de
metodología; este fichero es el que manda).

## 0. Prioridad de las reglas

1. **La sección 3 de `AGENTS.md` es inquebrantable**: comentarios y textos de
   interfaz en español, estética retro de los años 80, sin frameworks ni
   librerías CSS modernas.
2. Esta skill **no sustituye** esas reglas: las hace aplicables. Cuando una
   recomendación genérica de la skill original contradiga el retro 80s, gana el
   retro 80s.
3. Todo el frontend es **HTML + CSS + JS vanilla + `js/quizlib.min.js`**. Nada
   de React, Tailwind, Bootstrap, Google Fonts ni CDN externos: el quiz debe
   funcionar abriendo `index.html` sin red.

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
- **El material y el lenguaje**: la pantalla de la interfaz es un **monitor CRT
  de una computadora de los 80**: fósforo verde, cian, magenta y amarillo sobre
  negro; cuadrícula de rejilla; scanlines; tipografía de máquina de escribir;
  bordes con esquinas escalonadas (pixel art). Ese es el motivo por el que
  la interfaz **es** lo que es: no es un adorno, es el concepto.

## 2. La casa: tokens obligatorios

Los tokens ya existen en `css/style.css` (bloque `:root`). Reúsalos; no
introduzcas colores sueltos ni reescribas la paleta.

| Token | Valor | Uso |
|---|---|---|
| `--fondo` | `#05060f` | Fondo del monitor |
| `--fondo-panel` | `#0b1022` | Panel de la partida |
| `--neon-lima` | `#39ff14` | Aciertos, acción principal, explicación |
| `--neon-cian` | `#00e5ff` | Estructura: bordes, progreso, títulos de sección |
| `--neon-magenta` | `#ff2bd6` | Contrapunto y sombras duras |
| `--neon-amarillo` | `#ffe600` | Enunciado de la pregunta |
| `--verde` / `--rojo` | `#25ff7a` / `#ff2b4e` | Respuesta correcta / fallada |
| `--fuente` | monoespaciada | Única familia tipográfica |

Reglas de casa (heredadas de `AGENTS.md`):

- Fondo oscuro, siempre. Nunca fondo crema ni claro.
- Acentos neón: verde lima, cian, magenta, amarillo. Nada de terracota ni tonos
  cálidos.
- Tipografía **monoespaciada** (`"Courier New", "Lucida Console", monospace`).
  Si alguna vez necesitas una segunda familia, tendría que ser una pixel font
  local y claramente distinta, nunca la "sans por defecto".
- Bordes pixelados: usa `clip-path` con escalones de 4–10 px, no `border-radius`
  suave.
- Efecto de scanlines mediante `repeating-linear-gradient` en un overlay
  `position: fixed; pointer-events: none`.
- Sin sombras difusas suaves estilo SaaS: la sombra es dura y desplazada
  (`box-shadow: 4px 4px 0 ...`).
- Sin `linear-gradient` decorativo de fondo tipo "lavanda" ni rejilla de
  gradientes modernistas.

## 3. Principios de diseño (adaptados)

### La tipografía lleva la personalidad

Una sola familia monoespaciada bien tratada es mejor que dos familias
genéricas. Trabaja con:

- **Escala**: títulos grandes con `letter-spacing` amplio (4–6 px) y pesos 700;
  enunciados de pregunta en 1.05 rem; etiquetas en 0.78–0.9 rem.
- **Longitud de línea**: en este proyecto manda la legibilidad de un enunciado
  largo; usa `max-width` de 60–75 caracteres y `line-height` 1.5–1.7.
- **Alineación**: a la **izquierda** para enunciados y opciones; centrado solo
  para la pantalla de bienvenida, la puntuación final y el pie.
- El tratamiento tipográfico debe ser parte del diseño, no un vehículo neutro:
  el `text-shadow` con doble desplazamiento (lima + magenta) es el recurso
  house.

### La estructura visual es información

- Bordes, paneles y la barra de progreso **encuadran** el contenido: separan
  estados (pendiente / respondida / correcta) y no decoran.
- La barra de progreso es un indicador literal (segmentos de 10 px con brillo
  neón), no una barra redondeada con degradado.
- **No uses mayúsculas decorativas fuera de donde el retro las pide**: sí en
  títulos de pantalla, rótulos de estado (`> EXPLICACIÓN`) y botones; **no** en
  el enunciado de la pregunta ni en las opciones (son texto que se lee, no
  cromo). Esta es la versión de OPOQUIZ de "evita las mayúsculas en etiquetas":
  las mayúsculas aquí son un recurso de máquina, no un adorno de plantilla.
- **No** numeres los elementos (`01 / 02 / 03`) salvo que la secuencia sea real:
  la numeración solo aparece en `PREGUNTA 7 / 30`, que sí es una secuencia.

### Movimiento

- El movimiento no disparado por el usuario se usa con lupa: el parpadeo del
  título (`steps(1)`, 4 s) y la transición escalonada de la barra de progreso
  (`steps(8)`) son suficientes.
- **Respeta `prefers-reduced-motion`**: envuelve parpadeos, brillos y
  transiciones en una media query que los desactive. Es requisito de
  accesibilidad, no un extra.
- Cada hover y cada foco debe devolver información ("estás aquí"), nunca
  "`hover` por decoración".

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
   - **Principios**: qué hace que esa pantalla sea "de los 80" y no una más.
2. **Revisa el plan** contra el brief (aquí, contra `AGENTS.md` y el estilo
   retro ya existente en `css/style.css`). Si una parte del plan podría
   aplicarse tal cual a cualquier otra web, revísala: en este proyecto, ese
   es el signo de que has caído en el default.
3. **Construye** respetando la estructura existente: `index.html` con la
   jerarquía de pantallas, `css/style.css` con los tokens, `js/app.js` con la
   lógica. No añadas librerías.
4. **Critica tu propio trabajo**: haz capturas con Playwright
   (`npx playwright test` y el MCP de Playwright) y revísalas. Una captura
   vale más que mil tokens. Aplica el consejo de Chanel: antes de dar por
   terminado, quita un adorno.

## 5. Errores frecuentes en este proyecto

- Introducir un framework, CDN o Google Font.
- Poner mayúsculas o etiquetas decorativas en el enunciado y las opciones.
- Usar `border-radius` suave, sombras difusas o degradados de fondo "modernos".
- Salirse de la paleta: tonos cálidos, grises apagados o acentos nuevos.
- Poner texto en inglés en la interfaz o en los comentarios.
- **Marcar en verde la respuesta correcta de una pregunta que aún no se ha
  contestado**: solo las preguntas respondidas llevan color (verde la correcta,
  roja la fallada elegida). Es un fallo funcional, no de estilo.
- Romper el layout responsive: a 360 px de ancho las opciones deben seguir
  leyéndose y sin desbordar.
- Dejar la interfaz sin foco visible: los botones y las opciones necesitan
  `:focus-visible` con contorno neón.

## 6. Comprobaciones antes de dar por terminado

- [ ] `npx playwright test` en verde (incluye la prueba de que las preguntas
      sin contestar no muestran ningún color).
- [ ] Capturas revisadas: pantalla de inicio, pregunta contestada y pantalla
      final, en móvil (360 px) y escritorio (900 px).
- [ ] Todo el texto visible en español.
- [ ] Solo se usan tokens de `:root` y las clases ya existentes.
- [ ] Sin `border-radius`, sin sombras difusas, sin degradados decorativos,
      sin librerías nuevas.
- [ ] Foco visible y `prefers-reduced-motion` respetado.
