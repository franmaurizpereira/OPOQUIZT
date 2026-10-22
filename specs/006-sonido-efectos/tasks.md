# Tareas 006 — Efectos de sonido sintetizados

- [x] **1. Módulo de sonido** (RF1, RF5, RF6, RF7, RF9, RF11)
      Crear `js/audio.js`: contexto perezoso, cadena de válvulas, catálogo
      de 10 efectos y API pública con contadores.
      Hecho cuando: cargar la página no crea ningún `AudioContext`
      (`contextosCreados() === 0`), `reproducir()` con el sonido apagado
      devuelve `false` sin crear contexto, y sin `AudioContext` el módulo
      no lanza errores.

- [x] **2. Control de sonido en el HTML** (RF3, RF10)
      Añadir `#boton-sonido` a la cabecera y la etiqueta de `js/audio.js`.
      Hecho cuando: el botón se ve en inicio, quiz y final, dice
      «SONIDO: SÍ/NO», lleva `aria-pressed` y tiene `title` en español.

- [x] **3. Enganches del quiz** (RF1, RF2)
      Sonar en `change` (un solo resultado por pregunta), en `avance`, en
      `mostrarFinal` (cierre según tramo), en `abrirRevision` y
      `cerrarRevision`, en filtros y en los botones de inicio y reinicio.
      Hecho cuando: una partida completa pide 30 resultados, 29 avances y
      un cierre, y una pregunta sin contestar no pide nada.

- [x] **4. Estado y atajo de teclado** (RF3, RF4, RF5)
      Pintar el control desde el estado del módulo, alternarlo con clic y
      con la tecla `M`, guardar la preferencia en `localStorage`.
      Hecho cuando: silenciar cambia el texto y `aria-pressed`, la recarga
      lo recuerda y con el sonido apagado no se reproduce nada.

- [x] **5. Estilos del control** (RF3, RF8, RF10)
      Estilos en `css/style.css` con la paleta actual, estado apagado con
      texto y borde discontinuo (no solo color), `:focus-visible` y caso en
      `prefers-reduced-motion`.
      Hecho cuando: el contraste del texto es ≥ 4,5:1 en ambos estados y
      el foco es visible.

- [x] **6. Pruebas** (todos los RF)
      `tests/sonido.spec.js` con las 10 pruebas del plan.
      Hecho cuando: `npx playwright test` pasa entero (45 pruebas) y no
      hay errores de consola.

- [x] **7. Documentación** (RF11)
      README (sección Sonido), AGENTS.md §5 y §7, MEMORY.md y checklist
      del Reviewer.
      Hecho cuando: la regla de sonido accesible y la decisión de
      sintetizar quedan escritas, y el README explica cómo silenciarlo.
