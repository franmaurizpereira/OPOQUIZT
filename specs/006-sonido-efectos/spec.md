# Spec 006 — Efectos de sonido sintetizados

## 1. Objetivo

Añadir sonido a OPOQUIZ sin romper la regla de oro del proyecto: el juego
funciona **sin red**. Por eso los efectos no son ficheros de audio, sino
sonidos **sintetizados** con Web Audio en el propio navegador: cero
kilobytes, cero licencias y cero peticiones.

El sonido debe sonar a los años 50 de la dirección de arte actual (relés,
válvulas, teletipo, paneles del refugio), no a chips de 8 bits.

## 2. Decisiones del usuario (2026-10-22)

1. **Sintetizado**, no ficheros de audio.
2. **Encendido por defecto**, pero sin sonar nada hasta el primer gesto
   del jugador (lo exige el navegador de todos modos).
3. **Solo efectos puntuales**: no hay música ni zumbido de fondo. El
   zumbido queda descartado por fatiga auditiva y porque obligaría a un
   control de pausa permanente (WCAG 1.4.2).
4. **En toda la aplicación**: inicio, partida, pantalla final, revisión y
   botones.
5. **Sin voz**: leer las explicaciones exigiría TTS, o sea red o un modelo
   local nuevo, y rompería el requisito de funcionar sin red.

## 3. Requisitos funcionales (EARS)

- **RF1**: EL SISTEMA DEBE reproducir efectos de sonido en todas las
  acciones de la interfaz: empezar o reiniciar partida, contestar,
  avanzar de pregunta, abrir y cerrar la revisión, filtros, botones de la
  pantalla final y resultados finales, sin ficheros de audio ni peticiones
  de red.
- **RF2**: CUANDO el jugador contesta una pregunta, EL SISTEMA DEBE
  reproducir **exactamente un** efecto de resultado (acierto o fallo) y
  **una sola vez** por pregunta.
- **RF3**: EL SISTEMA DEBE ofrecer un control de sonido visible en todas
  las pantallas, con los dos estados escritos («SONIDO: SÍ» /
  «SONIDO: NO»), `aria-pressed` actualizado y accesible con teclado.
- **RF4**: EL SISTEMA DEBE recordar la preferencia de sonido entre
  recargas.
- **RF5**: MIENTRAS el sonido está apagado, EL SISTEMA NO DEBE crear el
  contexto de audio ni reproducir ningún efecto.
- **RF6**: EL SISTEMA NO DEBE emitir ningún sonido antes del primer gesto
  del jugador.
- **RF7**: SI el navegador no soporta Web Audio o lo bloquea, ENTONCES EL
  SISTEMA DEBE seguir jugando sin errores y sin sonido.
- **RF8**: EL SONIDO NO DEBE ser el único canal de información: los
  estados de acierto y fallo siguen comunicándose con color **y** borde,
  fondo, icono o texto.
- **RF9**: EL SONIDO DEBE encajar con la estética (relés, válvulas,
  teletipo) y NO DEBE haber música ni bucle de fondo.
- **RF10**: TODOS los textos del control DEBEN estar en español y los
  comentarios del código, en español.
- **RF11**: EL SISTEMA NO DEBE añadir ficheros binarios, dependencias ni
  librerías nuevas.

## 4. Casos límite

1. **Partida completa**: 30 efectos de resultado, 29 de avance y un único
   efecto de cierre.
2. **Silenciar con un efecto sonando**: el sonido se corta en menos de
   30 ms y sin chasquido.
3. **Sonidos solapados** al contestar muy rápido: nunca más de dos voces
   a la vez y sin subir el volumen.
4. **Recarga de la página**: no suena nada por sí sola.
5. **Navegador sin `AudioContext`** (o con el audio bloqueado por
   política): la partida se juega igual.
6. **Pulsar la tecla `M`** mientras el foco está en un campo de escritura:
   no se alterna el sonido.
7. **Pruebas en headless**, sin dispositivo de salida: no puede haber
   errores en consola ni pruebas que dependan de oír nada.

## 5. Fuera de alcance

- Música de fondo o ambiente continuo.
- Voz sintética o lectura de explicaciones.
- Sonidos distintos por asignatura o por documento.

Estado: implementada (2026-10-22).
