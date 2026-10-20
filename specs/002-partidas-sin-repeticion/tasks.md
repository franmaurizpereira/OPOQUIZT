# Tasks 002 · Partidas sin repeticiones, con orden variable y con historial fiable

**Spec:** `spec.md` · **Plan:** `plan.md`

---

## T1 · Aislar el historial de las pruebas
**RF:** RF3
**Ficheros:** `backend/historial.py`, `playwright.config.js`, `tests/quiz.spec.js`

- [x] La ruta del historial sale de `OPOQUIZ_HISTORIAL` si está definida.
- [x] El servidor de pruebas la arranca con `data/partidas-test.json`.
- [x] Las pruebas escriben en ese fichero, nunca en el del usuario.

**Hecho cuando:** la suite se ejecuta y `data/partidas.json` no cambia.

---

## T2 · Deduplicación por enunciado y por opciones
**RF:** RF1, RF4
**Ficheros:** `backend/generate_quiz.py`

- [x] `deduplicar()` descarta una pregunta cuyas opciones se solapen
      claramente con las de otra ya guardada.

**Hecho cuando:** dos preguntas con las mismas opciones nunca coexisten en el
resultado de `deduplicar()`.

---

## T3 · Reparar el banco publicado
**RF:** RF1, RF4
**Ficheros:** `backend/reparar_quiz.py`, `js/quiz.js`

- [x] Script que lee `js/quiz.js`, detecta preguntas solapadas, conserva la
      primera de cada grupo y sustituye las demás por nuevas de la BD.
- [x] Las nuevas se validan (formato, respaldo en el texto y no solapamiento
      con las conservadas).
- [x] Reescribe `js/quiz.js` con el formato del proyecto (4 opciones
      prefijadas, `correcta` 0-3, explicación).

**Hecho cuando:** en `js/quiz.js` no hay dos preguntas con el mismo conjunto de
opciones, y siguen siendo 30 preguntas válidas.

---

## T4 · Mezclar preguntas y opciones en cada partida
**RF:** RF2
**Ficheros:** `js/app.js`

- [x] Al construir la partida se copia `quizData` y se mezclan preguntas y
      opciones; se recalcula la posición de la correcta.
- [x] Toda la lógica usa la copia mezclada (`partida`), no `quizData`.
- [x] Al reiniciar se vuelve a mezclar.

**Hecho cuando:** dos partidas consecutivas muestran un orden distinto y
alguna respuesta correcta cambia de posición.

---

## T5 · Pruebas automáticas
**RF:** RF1, RF2, RF3
**Ficheros:** `tests/quiz.spec.js`

- [x] Prueba: en una partida no se repiten enunciados ni opciones.
- [x] Prueba: dos partidas seguidas cambian el orden.
- [x] Prueba: la posición de alguna respuesta correcta cambia entre partidas.
- [x] Prueba: la partida terminada se registra con los aciertos y fallos
      correctos.
- [x] Prueba: la suite no toca el historial del usuario.

**Hecho cuando:** `npx playwright test` pasa todas las pruebas en verde.

---

## T6 · Documentación y cierre
**RF:** —
**Ficheros:** `README.md`, `MEMORY.md`

- [x] `README.md`: dónde está el historial de pruebas y cómo se vacía.
- [x] `MEMORY.md`: decisiones (mezcla en cliente, aislamiento del historial,
      dedup por opciones) y errores a evitar.

**Hecho cuando:** la memoria refleja el estado real del proyecto.
