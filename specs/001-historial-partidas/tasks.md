# Tasks 001 · Historial de las últimas partidas

**Spec:** `spec.md` · **Plan:** `plan.md`
Máximo 10 tareas, en orden. Cada una se implementa, se valida y se marca como
hecha antes de pasar a la siguiente.

---

## T1 · Almacén del historial
**RF:** RF1, RF4
**Ficheros:** `backend/historial.py`

- [x] Módulo con `leer_partidas()` y `guardar_partida(aciertos, fallos)`.
- [x] Fichero `data/partidas.json` con `{ "partidas": [...] }`, creado solo si
      hace falta; escritura atómica; se ignoran en git.
- [x] Valida enteros, rango 0–30 y `aciertos + fallos = 30`; si el fichero
      está corrupto, se lee como lista vacía sin romper nada.
- [x] Se conservan como máximo las 100 partidas más recientes.
- [x] Guarda la fecha como ISO local `YYYY-MM-DDTHH:MM:SS`.

**Hecho cuando:** guardar y releer devuelve la partida recién guardada con
fecha, aciertos y fallos, y un fichero corrupto no lanza excepciones.

---

## T2 · Servidor con API del historial
**RF:** RF1, RF3
**Ficheros:** `backend/server.py`, `playwright.config.js`, `.gitignore`

- [x] Servidor en `127.0.0.1` que sirve `index.html`, `css/` y `js/` **y nada
      más** (todo lo demás, 404).
- [x] `GET /api/partidas` → `{"partidas": [...]}`.
- [x] `POST /api/partidas` → valida, guarda y responde 201 con la lista.
- [x] Escrituras serializadas (sin carreras).
- [x] `--port` configurable; por defecto 8099.
- [x] `playwright.config.js` usa el servidor nuevo y espera a `/api/partidas`.
- [x] `.gitignore` ignora `data/`.

**Hecho cuando:** `GET` y `POST` responden correctamente, `credencial.yaml`
devuelve 404 y `npx playwright test` arranca su propio servidor sin conflicto.

---

## T3 · Bloque del historial en la pantalla de inicio
**RF:** RF2
**Ficheros:** `index.html`, `css/style.css`

- [x] Bloque `> ÚLTIMAS PARTIDAS` en la pantalla de inicio, con lista y
      mensaje de estado vacío.
- [x] Cada fila: fecha `dd/mm/aaaa`, aciertos en verde y fallos en rojo.
- [x] Estilo retro 80s coherente con el resto (sin `border-radius`, sin
      sombras difusas, tokens existentes).
- [x] Textos en español.

**Hecho cuando:** el bloque se ve integrado en la pantalla de inicio, con
colores de la paleta y sin introducir estilos modernos.

---

## T4 · Cargar el historial al mostrar el inicio
**RF:** RF2, RF3
**Ficheros:** `js/app.js`

- [x] `cargarHistorial()` pide el historial y pinta como máximo 5 filas, de la
      más reciente a la más antigua.
- [x] Formato de fecha `dd/mm/aaaa` a partir de la marca de tiempo.
- [x] Sin partidas → mensaje de estado vacío; con error → el bloque se oculta
      y el juego sigue funcionando.

**Hecho cuando:** al abrir la app se ven las últimas partidas en orden, y si
la API falla la pantalla de inicio sigue siendo utilizable.

---

## T5 · Registrar la partida al terminar
**RF:** RF1, RF3
**Ficheros:** `js/app.js`

- [x] Al mostrar la pantalla final se envía la partida con sus aciertos y
      fallos.
- [x] Si el registro falla, el resultado se muestra igualmente.
- [x] La partida se registra **una sola vez** (no se duplica al reiniciar).

**Hecho cuando:** tras una partida, el historial del fichero incluye una
entrada nueva con la puntuación correcta.

---

## T6 · Pruebas automáticas del historial
**RF:** RF1, RF2, RF3
**Ficheros:** `tests/quiz.spec.js`

- [x] Prueba: con 7 partidas registradas se muestran 5, ordenadas.
- [x] Prueba: aciertos en verde y fallos en rojo.
- [x] Prueba: sin partidas se muestra el mensaje y la app sigue usable.
- [x] Prueba: al terminar una partida se guarda una entrada nueva.

**Hecho cuando:** `npx playwright test` pasa todas las pruebas (las 8
existentes + las nuevas) en verde.

---

## T7 · Documentación y cierre
**RF:** —
**Ficheros:** `README.md`, `MEMORY.md`

- [x] `README.md`: cómo arrancar la app con el servidor nuevo, dónde está el
      historial y cómo se vacía.
- [x] `MEMORY.md`: decisiones (fichero local, servidor propio) y errores a
      evitar (nunca exponer el proyecto entero por HTTP).

**Hecho cuando:** un lector nuevo sabe cómo arrancar la app y dónde mirar el
historial.
