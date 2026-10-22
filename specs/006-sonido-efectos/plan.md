# Plan 006 — Efectos de sonido sintetizados

## 1. Ficheros

| Fichero | Cambio |
|---|---|
| `js/audio.js` | **Nuevo**. Módulo de sonido: contexto perezoso, cadena de válvulas y catálogo de efectos |
| `index.html` | Etiqueta `<script src="js/audio.js">` y el control `#boton-sonido` dentro de la cabecera |
| `js/app.js` | Enganches de sonido en los eventos y pintado del control; atajo `M` |
| `css/style.css` | Estilos del control (`.sonido`, `.boton-sonido`, `.sonido-altavoz`) y su caso en `prefers-reduced-motion` |
| `tests/sonido.spec.js` | **Nuevo**. 10 pruebas |
| `README.md`, `AGENTS.md`, `MEMORY.md` | Documentar el sonido y su regla de accesibilidad |
| `specs/006-sonido-efectos/` | Spec, plan y tareas |

No se toca `js/quizlib.min.js`, ni `backend/`, ni `js/quiz.js`.

## 2. Decisiones

### 2.1 Sintetizar en vez de servir ficheros

**Alternativa descartada**: ficheros `.ogg`/`.mp3` en una carpeta nueva.
Obligaría a abrir esa carpeta en `CARPETAS_PERMITIDAS` de
`backend/server.py`, a elegir y documentar licencias CC0 y a sumar
100–300 KB al repositorio. La síntesis da 0 KB, 0 licencias y 0 cambios
en el servidor.

**Consecuencia**: el sonido se describe como parámetros (frecuencias,
duraciones, filtros) en el propio código. Es más difícil de "afinar a
oído", pero es reproducible y versionable.

### 2.2 Un solo contexto, creado en el primer gesto

**Alternativa descartada**: crear el `AudioContext` al cargar la página.
Los navegadores lo dejan en estado `suspended` y, en algunos, genera un
aviso en consola. Se crea dentro de `reproducir()`, que solo se llama
desde un gesto del jugador.

### 2.3 El sonido de resultado va en el evento `change`, no en `comprobarYMarcas()`

`comprobarYMarcas()` recorre **las 30 preguntas** cada vez que se
contesta una, para repintar las ya respondidas. Si el sonido viviera ahí,
sonaría una vez por cada pregunta contestada (30 veces por partida).

### 2.4 Cadena de válvulas

`voces → paso bajo 4,8 kHz → paso alto 120 Hz → volumen general → salida`

El paso bajo quita el brillo digital y deja un timbre de válvula; el paso
alto evita retumbe en altavoces pequeños. Volumen general bajo (0,22):
son efectos de fondo, no una alarma.

### 2.5 Control dentro de la cabecera, no flotante

**Alternativa descartada**: botón `position: fixed` arriba a la derecha.
A 390 px el título ocupa casi todo el ancho y el botón lo taparía. Al ir
en el flujo de la cabecera, aparece en todas las pantallas sin solapar y
sin `z-index` nuevos.

### 2.6 Preferencia en `localStorage`

La aplicación no usaba `localStorage`; se estrena con una única clave,
`opoquiz-sonido` (`'1'`/`'0'`). Si el navegador lo bloquea, se usa el
valor por defecto (encendido) y no se rompe nada.

### 2.7 Sonidos y momentos

| Efecto | Cuándo | Duración |
|---|---|---|
| `arranque` | Empezar o reiniciar partida | ~0,35 s |
| `clic-ui` | Botones, filtros, volver al inicio | ~0,08 s |
| `acierto` | Respuesta correcta | ~0,25 s |
| `fallo` | Respuesta incorrecta | ~0,35 s |
| `avance` | Pasar a la siguiente pregunta | ~0,15 s |
| `modal-abrir` | Abrir la revisión | ~0,25 s |
| `modal-cerrar` | Cerrar la revisión | ~0,25 s |
| `final-bien` | ≥ 90 % de aciertos | ~0,55 s |
| `final-medio` | 50–89 % | ~0,35 s |
| `final-mal` | < 50 % | ~0,45 s |

### 2.8 Niveles medidos

Medido con un `OfflineAudioContext` (renderizado real de la onda, no
estimación): ningún efecto recorta y todos quedan por debajo de −6 dBFS.

| Efecto | Pico | Duración audible |
|---|---|---|
| `arranque` | −24,1 dBFS | 0,25 s |
| `clic-ui` | −26,5 dBFS | 0,03 s |
| `acierto` | −21,7 dBFS | 0,20 s |
| `fallo` | −19,4 dBFS | 0,22 s |
| `avance` | −30,2 dBFS | 0,11 s |
| `modal-abrir` | −23,9 dBFS | 0,13 s |
| `modal-cerrar` | −23,7 dBFS | 0,12 s |
| `final-bien` | −22,8 dBFS | 0,58 s |
| `final-medio` | −23,2 dBFS | 0,26 s |
| `final-mal` | −23,5 dBFS | 0,41 s |

El volumen maestro es 0,5; los avisos importantes (acierto, fallo, cierre)
quedan unos 5–9 dB por encima de los clics de interfaz.

## 3. API del módulo (funciones puras y estado)

`js/audio.js` expone `window.OPOQUIZ_AUDIO`:

| Miembro | Tipo | Para qué |
|---|---|---|
| `reproducir(nombre)` | `string → boolean` | Pide un efecto; devuelve si sonó |
| `estaActivo()` | `→ boolean` | Estado actual |
| `activar()` / `silenciar()` / `alternar()` | `→ boolean` | Cambian el estado y lo guardan |
| `veces(nombre)` | `string → number` | Contador por efecto (pruebas) |
| `total()` | `→ number` | Efectos reproducidos (pruebas) |
| `contextosCreados()` | `→ number` | 0 hasta el primer gesto (pruebas) |
| `efectos()` | `→ string[]` | Catálogo disponible |

Los contadores existen para que las pruebas puedan comprobar el
comportamiento **sin depender de oír nada**: en headless no hay oído.

## 4. Requisitos cubiertos

| Parte | RF |
|---|---|
| Catálogo y síntesis | RF1, RF9, RF11 |
| Enganche en `app.js` | RF1, RF2, RF6 |
| Control y atajo `M` | RF3, RF4, RF10 |
| Preferencia y contexto perezoso | RF5, RF6, RF7 |
| Estilos del control | RF3, RF8, RF10 |

## 5. Estrategia de pruebas

`tests/sonido.spec.js`, con el mismo servidor de pruebas (puerto 8100,
historial propio):

1. El módulo existe, arranca encendido y **no** ha creado contexto al cargar.
2. El primer clic en EMPEZAR crea el contexto (una sola vez).
3. Contestar pide exactamente un resultado; acertar y fallar piden el suyo.
4. Avanzar pide un único `avance`.
5. El control silencia, se recuerda tras recargar y **no** reproduce nada
   mientras está apagado.
6. La tecla `M` alterna.
7. Una partida completa: 30 resultados, 29 avances y un cierre.
8. Sin `AudioContext` la app sigue jugando y sin errores de consola.
9. Contraste AA del control encendido y apagado, medido en el navegador.
10. Textos del control en español.

Además se mantienen las 35 pruebas existentes: el global de «todos los
textos visibles están en español» cubre el texto nuevo del control.
