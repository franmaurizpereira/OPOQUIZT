# Spec 004 · Revisión de la partida en ventana modal

**Estado:** borrador
**Fecha:** 2026-10-22
**Solicitud original:** "Cuando acabas una partida que te dé la opción de ver las preguntas que contestaste en esa partida, para comprobar las preguntas que contestaste mal y bien con su explicación, en una ventana modal. Puedes usar el modelo deepseek-v4-pro para hacerlo."

---

## 1. Problema

Al terminar una partida, la pantalla final solo ofrece la puntuación y un
mensaje. La persona que haFallado 12 preguntas no tiene forma de saber
**cuáles** ha fallado ni **por qué** la respuesta que eligió era incorrecta:
solo le queda el recuerdo de lo que vio. El material de estudio (las
explicaciones de cada pregunta) ya existe en el banco, pero queda escondido
durante la partida y se descarta al terminar.

Con el pool de 600 preguntas (spec 003) este hueco se ha hecho más evidente:
cada partida es distinta, así que no se puede "repetir" la que salió mal.

## 2. Objetivo

Que al acabar una partida la persona pueda abrir una **ventana modal** con
todas las preguntas que contestó, con el resultado de cada una (acertada,
fallada o sin contestar), la opción que eligió, la que era correcta y la
**explicación**, para repasar los fallos.

## 3. Alcance

**Incluido**
- Botón de revisión en la pantalla final de partida.
- Ventana modal con la revisión completa de la partida, con filtros por
  resultado y navegación por teclado.
- Conservación del detalle de la partida en el historial, para poder
  repasar también partidas anteriores desde la pantalla de inicio.
- Explicaciones de calidad en español, revisadas con un modelo de lenguaje
  (`deepseek-v4-pro` vía OpenRouter).

**Excluido**
- Estadísticas por tema o por documento.
- Exportar la revisión a PDF o a un fichero.
- accounts de usuario, sincronización entre equipos o perfiles.
- Cualquier dependencia de red **en tiempo de juego**: la modal funciona sin
  conexión con el detalle guardado.

## 4. Requisitos funcionales (EARS)

### RF1 · Ofrecer la revisión al terminar la partida
- AL TERMINAR UNA PARTIDA, EL SISTEMA DEBE OFRECER LA OPCIÓN DE REVISAR LAS
  PREGUNTAS CONTESTADAS.
- LA REVISIÓN DEBE ABRIRSE EN UNA VENTANA MODAL SOBRE LA PANTALLA FINAL.
- AL CERRAR LA MODAL, LA PANTALLA FINAL DEBE PERMANECER INTACTA (la
  puntuación y los botones siguen visibles y utilizables).
- SI LA PANTALLA FINAL NO TIENE PARTIDA QUE REVISAR (por ejemplo, se ha
  recargado la página), EL SISTEMA NO DEBE MOSTRAR EL BOTÓN DE REVISIÓN.

### RF2 · Contenido de la revisión
- LA MODAL DEBE MOSTRAR TODAS LAS PREGUNTAS DE LA PARTIDA, EN EL ORDEN EN
  QUE SE MOSTRARON.
- CADA PREGUNTA DEBE MOSTRAR: su número, su enunciado, sus cuatro opciones,
  la opción que se eligió, cuál era la correcta, si se acertó o se falló y su
  explicación.
- LA OPCIÓN CORRECTA DEBE MARCARSE EN VERDE Y LA ELEGIDA, CUANDO ES
  INCORRECTA, EN ROJO, CON EL MISMO ESTILO QUE DURANTE LA PARTIDA.
- UNA PREGUNTA SIN CONTESTAR NO DEBE MOSTRAR NINGÚN COLOR NI SU EXPLICACIÓN:
  no se puede adelantar la respuesta correcta (regla global de `AGENTS.md`).
- LA MODAL DEBE MOSTRAR UN RESUMEN CON EL NÚMERO DE ACIERTOS, FALLOS Y
  PREGUNTAS SIN CONTESTAR.

### RF3 · Filtros y cierre de la modal
- LA MODAL DEBE PERMITIR FILTRAR LA REVISIÓN POR RESULTADO: todas,
  acertadas, falladas y sin contestar.
- SI NO HAY NINGUNA PREGUNTA QUE CUMPLA EL FILTRO ACTIVO, EL SISTEMA DEBE
  MOSTRAR UN MENSAJE QUE LO DIGA, EN LUGAR DE UNA LISTA VACÍA.
- LA MODAL DEBE PODER CERRARSE CON UN BOTÓN, CON LA TECLA `ESCAPE` Y CON UN
  CLIC FUERA DEL PANEL.
- AL ABRIRSE LA MODAL, EL FOCUS DEBE IR A ELLA; AL CERRARSE, EL FOCUS DEBE
  VOLVER AL BOTÓN QUE LA ABRIÓ.
- LA MODAL NO DEBE ABRIRSE NI MOSTRARSE CON VÁRIAS COPIAS A LA VEZ.

### RF4 · Revisión de partidas anteriores
- CADA PARTIDA DEL HISTORIAL QUE TENGA DETALLE GUARDADO DEBE PODER REVISARSE
  DESDE LA PANTALLA DE INICIO.
- AL REGISTRAR UNA PARTIDA, EL SISTEMA DEBE CONSERVAR SU DETALLE (preguntas,
  opciones, elección, resultado y explicaciones) junto a la puntuación.
- SI UNA PARTIDA DEL HISTORIAL NO TIENE DETALLE GUARDADO (partidas jugadas
  antes de esta versión), EL SISTEMA NO DEBE OFRECER SU REVISIÓN NI FALLAR
  AL MOSTRAR EL HISTORIAL.

### RF5 · Estilo, idioma y funcionamiento sin red
- TODOS LOS TEXTOS VISIBLES DE LA MODAL DEBEN ESTAR EN ESPAÑOL.
- LA MODAL DEBE SEGUIR LA ESTÉTICA RETRO DE LOS AÑOS 80 DEL RESTO DE LA
  APLICACIÓN (fondo oscuro, acentos neón, monoespaciada, bordes pixelados).
- LA REVISIÓN DEBE FUNCIONAR SIN CONEXIÓN: el detalle de la partida se
  guarda en el equipo, no se descarga de Internet.
- LA MODAL DEBE PODER USARSE CON TECLADO Y CON RATÓN.

### RF6 · Explicaciones de calidad en la revisión
- LAS EXPLICACIONES QUE SE MUESTRAN EN LA REVISIÓN DEBEN ESTAR EN ESPAÑOL Y
  SER AUTOCONTENIDAS: NO DEBEN REFERIRSE A "EL TEXTO", "EL CONTEXTO" O "EL
  PASQUEFE" (no existen para quien lee la revisión).
- EL GENERADOR DE EXPLICACIONES DEBE PODER USAR UN MODELO REMOTO
  CONFIGURABLE POR VARIABLE DE ENTORNO.
- AL REESCRIBIR EXPLICACIONES, EL ENUNCIADO Y LAS OPCIONES NO DEBEN
  CAMBIAR: solo mejora el texto de la explicación.
- SI LA REESCRITURA DE UNA EXPLICACIÓN NO SUPERA LA VALIDACIÓN, EL SISTEMA
  DEBE CONSERVAR LA EXPLICACIÓN ANTERIOR.

## 5. Casos límite

| Caso | Comportamiento esperado |
|---|---|
| Partida con 30 preguntas contestadas | La modal lista las 30, en el orden en que se vio. |
| Partida con alguna pregunta sin contestar | Esa pregunta se muestra sin colores ni explicación, y cuenta como "sin contestar". |
| Filtro sin resultados (p. ej. 0 falladas) | Mensaje "no hay preguntas con ese filtro", no una lista vacía. |
| Apertura de la modal dos veces seguidas | Solo hay una modal en pantalla. |
| `ESCAPE` con la modal abierta | La modal se cierra y el foco vuelve al botón de origen. |
| Clic fuera del panel | La modal se cierra. |
| Partida del historial sin detalle (anterior a esta versión) | El historial se muestra igual, sin botón de revisar. |
| Fichero de historial corrupto | El historial se muestra vacío y el juego sigue funcionando. |
| Partida abandonada a mitad (volver a INICIO) | No hay revisión que ofrecer: el botón no aparece. |
| Explicación con acentos, comillas o eñes | Se muestra correctamente, sin entidades extrañas. |
| Ventana estrecha (móvil) | La modal ocupa casi toda la pantalla y el contenido se puede desplazar. |
| Explicación reescrita que no pasa la validación | Se conserva la explicación anterior. |

## 6. Criterios de aceptación (verificables)

1. Al terminar una partida, la pantalla final tiene un botón para revisar la
   partida y la modal se abre encima.
2. La modal muestra las 30 preguntas de la partida, en el orden en que se
   mostraron.
3. Cada pregunta muestra enunciado, sus cuatro opciones, la opción elegida,
   la correcta, si se acertó o se falló, y la explicación.
4. La opción correcta aparece en verde; la elegida cuando es incorrecta, en
   rojo; el resto, sin color.
5. Las preguntas sin contestar aparecen sin color y sin explicación.
6. La modal muestra un resumen con aciertos, fallos y sin contestar.
7. Los filtros (todas / acertadas / falladas / sin contestar) muestran
   subconjuntos correctos y avisan cuando no hay ninguna.
8. La modal se cierra con el botón, con `ESCAPE` y con un clic fuera, y el
   juego sigue utilizable después.
9. Desde la pantalla de inicio se puede revisar una partida anterior que
   tenga detalle guardado.
10. Una partida del historial sin detalle no impide ver el historial ni jugar.
11. Las explicaciones visibles no contienen "el texto", "el contexto" ni
    "el pasaje".
12. La suite de pruebas automáticas sigue en verde y no toca el historial
    real de la persona.
13. Todos los textos de la modal están en español y el estilo es retro 80s.

## 7. Decisiones

| # | Decisión | Consecuencia |
|---|---|---|
| D1 | La revisión muestra **todas las preguntas de la partida en una lista con desplazamiento**, no de una en una. | Se compara de un vistazo qué se falló; no hay que ir pulsando 30 veces. |
| D2 | El detalle de la partida **se guarda en el historial** (fichero local), no solo en memoria. | Se puede repasar una partida al día siguiente, que es justo cuando se estudia. |
| D3 | El detalle se conserva solo de las **partidas más recientes**; de las antiguas se poda para que el fichero no crezca sin límite. | El fichero del historial se mantiene manejable. |
| D4 | Las explicaciones del pool se reescriben con el **modelo rápido y gratuito de OpenRouter** (`minimax/minimax-m3.1-flash:free`), no con uno grande: el problema que se arregla (quitar referencias a "el texto") no necesita un modelo potente y así no cuesta nada. | La revisión enseña explicaciones utilizables y el pool se puede pulir sin gastar. El modelo queda configurable (`OPENROUTER_MODEL`) por si en algún momento se quiere otro. |
| D5 | La modal se construye con HTML, CSS y JavaScript del proyecto, **sin dependencias nuevas**. | El juego sigue funcionando sin red y sin ficheros extra en el navegador. |
