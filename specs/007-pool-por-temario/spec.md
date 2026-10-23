# Spec 007 — Pool de 2.000 preguntas etiquetado por temario

**Estado:** borrador (aprobada la dirección por el usuario el 2026-10-22)
**Solicitud original:** «¿No se podría hacer varias versiones distintas de
`quiz_pool.json` con más preguntas sacadas de la base de datos para así
poder abarcar más todo el contenido de la base de datos para preguntas?»

## 1. Problema

El pool actual tiene 600 preguntas sacadas de 600 de los 2.555 fragmentos
de la base de datos. Medido sobre la BD, eso cubre el **25,7 % del texto**
(549.437 de 2.138.708 caracteres) y el **31,6 % de las páginas** (274 de
866). Una partida usa 30 preguntas, o sea el 1,4 % del texto útil.

Peor aún es el reparto: el generador daba 66-68 preguntas a cada PDF sin
mirar su tamaño, así que los documentos más gordos son los peor cubiertos
(Gobierno 13,9 %, TREBEP 14,4 %, Igualdad 19,6 %) mientras los pequeños
van sobrados (Constitución 65,1 %, Instrumentos 78,2 %). Y como hay 9
temarios y 30 preguntas, en **una de cada cuatro partidas falta al menos
un tema** (con ~67 preguntas por tema, la probabilidad de que falte uno
concreto es del 3 %; con 9 temas, del 24 %).

## 2. Decisiones del usuario (2026-10-22)

1. **Cobertura por temario**: cada partida debe tocar todos los
   documentos, no solo la mayoría.
2. **2.100 preguntas** (se partió de 2.000; se sube para absorber los
   descartes por duplicados y llegar al 90 % de texto con margen). El
   techo real por fragmento es 2.265.
3. **Rotación**: no repetir preguntas ya vistas mientras queden sin ver.
4. **Un solo fichero** de pool, no varios.
5. **Regenerar desde cero**, no ampliar la caché actual.

La combinación 1 + 4 se resuelve con un único fichero en el que cada
pregunta lleva su **tema**, y con el reparto por cuotas en el navegador.

## 3. Objetivo

Que el jugador pueda recorrer todo el contenido de la base de datos con
el paso del tiempo, sin repetir preguntas entre partidas y con la
seguridad de que cada partida toca los 9 temarios.

La cobertura se mide sobre el **texto** (caracteres), no sobre el número
de fragmentos: 290 fragmentos de menos de 250 caracteres son el 11 % de
los trozos pero solo el 2,3 % del texto, y forzar preguntas de ahí daría
preguntas malas a cambio de casi nada. Objetivo: **≥90 % del texto**.

## 4. Requisitos funcionales (EARS)

- **RF1**: EL POOL DEBE contener **2.100 preguntas válidas** como mínimo,
  sacadas de fragmentos distintos de la base de datos.
- **RF2**: CADA PREGUNTA DEL POOL DEBE llevar su **tema** (el documento
  del que sale), con una etiqueta legible en español.
- **RF3**: EL POOL DEBE cubrir los **9 documentos** de la base de datos,
  con al menos 50 preguntas por tema.
- **RF4**: CUANDO el jugador empieza una partida, EL SISTEMA DEBE incluir
  al menos ⌊30 / número de temas⌋ preguntas de **cada** tema del pool
  (3 por tema con 9 temas), y repartir las que sobran al azar entre los
  temas.
- **RF5**: CUANDO la partida se monta, EL SISTEMA DEBE preferir preguntas
  **no vistas** por el jugador; solo usará una ya vista si con las no
  vistas no se cubre la cuota de su tema.
- **RF6**: EL SISTEMA DEBE recordar entre visitas qué preguntas ha visto
  el jugador, sin enviar nada a la red.
- **RF7**: CUANDO se han visto todas las preguntas del pool, EL SISTEMA
  DEBE empezar un ciclo nuevo sin repetir de inmediato las de la última
  partida.
- **RF8**: CADA PARTIDA DEBE seguir teniendo 30 preguntas, sin repetir
  ninguna dentro de la misma partida y sin opciones repetidas mientras
  haya margen.
- **RF9**: SI el pool no trae temas (fichero antiguo) o el almacenamiento
  local está bloqueado, ENTONCES EL SISTEMA DEBE jugar como hasta ahora,
  sin errores y sin cuotas.
- **RF10**: EL JUEGO DEBE seguir funcionando sin red, sin base de datos y
  sin Ollama en tiempo de ejecución.
- **RF11**: EL VERIFICADOR DEL POOL DEBE rechazar: preguntas repetidas,
  opciones repetidas, campos que falten, temas desconocidos, menos de 50
  preguntas por tema, texto en inglés y explicaciones que hablan de «el
  texto» o «el pasaje».
- **RF12**: LA DOCUMENTACIÓN DEBE explicar el reparto por cuotas, la
  rotación y cómo regenerar el pool, y el README no debe afirmar cifras
  que ya no sean ciertas.
- **RF13**: EL VERIFICADOR DEBE medir la cobertura sobre la base de datos
  y exigir **≥90 % del texto global**, **≥85 % por documento** y **≥95 %
  de las páginas** con al menos una pregunta.
- **RF14**: EL REPARTO DE FRAGMENTOS DEBE ser proporcional al texto de
  cada documento (no igual por documento), y dentro de cada documento
  DEBE preferir los fragmentos largos y cubrir todas las páginas.

## 5. Casos límite

1. **Pool sin campo `tema`** (un `quiz_pool.json` viejo): se juega como
   hoy; no hay cuotas ni rotación.
2. **Un tema con menos preguntas que su cuota** (no debería pasar tras
   RF3): se completa con preguntas de otros temas hasta 30.
3. **Almacenamiento local lleno o bloqueado** (modo privado): la partida
   se monta igual, sin rotación.
4. **Se agotan las no vistas**: se reinicia el ciclo conservando las 30
   últimas para que la partida siguiente no sea idéntica.
5. **El pool se regenera** (cambia el número de preguntas): las vistas
   guardadas se descartan y el ciclo empieza limpio.
6. **Menos de 30 preguntas válidas en total**: el frontend sigue
   descartando el pool y usando `js/quiz.js`.
7. **Una pregunta vista aparece en la cuota de su tema pero no hay otra
   de ese tema sin ver**: se usa la vista; nunca se rompe la cuota.
8. **Dos partidas seguidas**: mientras queden no vistas, no comparten
   ninguna pregunta.
9. **Los descartes por duplicados o por validación** dejan el pool por
   debajo de 2.100: el gate admite ≥1.950, pero la cobertura debe seguir
   en ≥90 % (se comprueba sobre lo que hay, no sobre lo que se pidió).
10. **Un documento nuevo** que no esté en la lista de temas: no rompe la
    generación; su etiqueta es el nombre limpio del fichero.

## 6. Fuera de alcance

- Elegir el tema a mano («examen de Constitución»): no se pide y añade
  interfaz nueva.
- Varios ficheros de pool o manifiesto: descartado por el usuario.
- Subir el número de preguntas por partida (siguen siendo 30).
- Cambiar `js/quiz.js` (las 30 preguntas fijas de reserva).
