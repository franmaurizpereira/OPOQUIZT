# Plan 001 · Historial de las últimas partidas

**Estado:** implementado
**Spec:** `spec.md` (001-historial-partidas)
**Fecha:** 2026-10-20

---

## 1. Idea rectora

El navegador no puede escribir ficheros. Para guardar el historial en un
fichero local hace falta un proceso en el servidor. Aprovechando que ya
existe un servidor de desarrollo, la solución es **un único servidor que sirve
la interfaz y además expone el historial**: un solo proceso, un solo puerto,
sin CORS y sin dependencias nuevas.

```
navegador ──GET  /api/partidas ──▶  servidor (backend/server.py)
            ──POST /api/partidas ──▶        │
navegador ──GET  /index.html, /css/*, /js/* ─┴─▶  ficheros estáticos
                                                     │
                                        data/partidas.json  ← historial
```

## 2. Decisiones técnicas

### D1 · Un servidor propio en lugar de `python3 -m http.server`
- **Motivo**: hace falta un endpoint que escriba en disco. Un único proceso
  evita el problema de CORS y el segundo puerto.
- **Alternativa descartada**: un segundo proceso de API en otro puerto
  (obligaría a CORS y a dos comandos para arrancar la app).
- **Alternativa descartada**: guardar en `localStorage` (no persistiría entre
  navegadores ni permitiría consultar desde otro sitio; la spec pide fichero).

### D2 · Fichero `data/partidas.json`
- Formato: `{"partidas": [{"fecha": "2026-01-12T10:23:45", "aciertos": 21, "fallos": 9}]}`
- `fecha` en ISO local **sin zona horaria**: se parsea igual en cualquier
  equipo y permite ordenar por la marca de tiempo real.
- Se conservan las **100 últimas** partidas (el fichero no crece sin límite);
  la interfaz solo muestra 5.
- El fichero se crea solo la primera vez y se **ignora en git** (es estado
  local, no código).

### D3 · API mínima en JSON
| Método | Ruta | Entrada | Salida |
|---|---|---|---|
| GET | `/api/partidas` | — | `{"partidas": [...]}` (más reciente primero) |
| POST | `/api/partidas` | `{"aciertos": n, "fallos": n}` | `{"partidas": [...]}` (201) |

- El POST **valida**: enteros, `0 ≤ n ≤ 30` y `aciertos + fallos = 30`.
  Cualquier otra cosa se rechaza con 400 y no se escribe nada.

### D4 · El servidor solo sirve rutas permitidas
- `python3 -m http.server` sirve **todo** el directorio, así que hoy
  `credencial.yaml` y el repo son accesibles desde el navegador. El servidor
  nuevo sirve **solo** `index.html`, `css/` y `js/`; el resto responde 404.
- Esto cierra un agujero de seguridad que ya existía.

### D5 · El servidor se ata a 127.0.0.1
- La app es de uso local: no se expone a la red.

## 3. Ficheros afectados

| Fichero | Qué hace |
|---|---|
| `backend/historial.py` (nuevo) | Leer y guardar partidas en `data/partidas.json`; validar. |
| `backend/server.py` (nuevo) | Servidor: interfaz estática (lista blanca) + API del historial. |
| `index.html` | Bloque del historial en la pantalla de inicio. |
| `js/app.js` | `cargarHistorial()` al mostrar el inicio; `registrarPartida()` al terminar. |
| `css/style.css` | Estilos retro del listado (fecha cian, aciertos verde, fallos rojo). |
| `tests/quiz.spec.js` | 3 pruebas nuevas del historial. |
| `playwright.config.js` | El servidor de pruebas pasa a ser `backend/server.py`. |
| `.gitignore` | Se ignora `data/`. |
| `README.md` | Cómo arrancar la app con el servidor nuevo. |
| `MEMORY.md` | Decisiones y errores a evitar (lo cierra el Coordinator). |

## 4. Estrategia de tests

Runner: **`npx playwright test`** (el único del proyecto).

El fichero del historial se escribe **antes** de cada prueba, de forma que
cada test es independiente del estado previo:

1. **Listado**: se escriben 7 partidas → se espera ver **5**, en orden de más
   reciente a más antigua, con la fecha en `dd/mm/aaaa`.
2. **Colores**: la cifra de aciertos se renderiza en verde (`--verde`) y la de
   fallos en rojo (`--rojo`) → se comprueba con `toHaveCSS`.
3. **Estado vacío**: sin partidas → aparece el mensaje "sin partidas" y la
   pantalla de inicio sigue siendo utilizable.
4. **Registro**: se termina una partida → el fichero contiene una entrada
   nueva con los aciertos y fallos correctos, y al volver al inicio aparece
   en el listado.

Comprobación manual: 404 en `credencial.yaml` al navegar, y partida completa
con alta en el fichero.

## 5. Requisitos cubiertos

| RF | Dónde se cumple |
|---|---|
| RF1 Registro | `backend/historial.py` + POST `/api/partidas` + `registrarPartida()` |
| RF2 Presentación | `index.html` + `js/app.js` + `css/style.css` |
| RF3 Disponibilidad | `fetch` con `try/catch`: si falla, el juego continúa y el listado se oculta |
| RF4 Privacidad | Solo fecha y puntuaciones; sin identificadores de jugador |

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Que el navegador no pueda escribir → el requisito parecería imposible | Se resuelve con el servidor propio (D1) |
| Que el fichero se corrompa al escribir | Se escribe de forma atómica (fichero temporal + `replace`) y, si no se puede leer, se devuelve una lista vacía sin romper la app |
| Que dos partidas se registren a la vez | El servidor es monohilo para las escrituras (un `ThreadingHTTPServer` con un lock) y cada partida es una línea más |
| Que se rompa el arranque actual | El puerto y la URL se mantienen; el Playwright config apunta al nuevo servidor |
| Que el endpoint acepte basura | Validación estricta en el servidor (D3) |

## 7. Fuera de este plan

- Migrar el historial a PostgreSQL (descartado por D1 del usuario).
- Multiusuario, sincronización, estadísticas agregadas.
- Cualquier cambio en la lógica del quiz o en el modelo de datos.
