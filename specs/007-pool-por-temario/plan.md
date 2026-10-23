# Plan 007 — Pool de 2.000 preguntas etiquetado por temario

## 1. Datos medidos (2026-10-22)

| Dato | Valor | Cómo se ha medido |
|---|---|---|
| Fragmentos en la BD | 2.555 | `select count(*) from chunks` |
| Fragmentos útiles (≥250 caracteres) | 2.265 | `select count(*) filter (where length(contenido) >= 250)` |
| Preguntas actuales | 600 | `json.load(js/quiz_pool.json)` |
| Fragmentos usados | 600, todos distintos | `contexto_id` de `logs/pool_cache.json` |
| Cobertura actual (fragmentos) | 23,5 % | 600 / 2.555 |
| **Cobertura actual (texto)** | **25,7 %** | 549.437 / 2.138.708 caracteres |
| **Cobertura actual (páginas)** | **31,6 %** | 274 de 866 páginas |
| Peso actual | 564 KB, 960 B por pregunta | `du` y división |
| Generación de 600 | 138 s con 8 workers y OpenRouter | `logs/pool.log` |
| Partida | 30 preguntas = 1,3 % del contenido útil | 30 / 2.265 |

Fragmentos útiles por documento y cobertura actual de su texto:

| Documento | Útiles | Texto cubierto hoy | Tema propuesto |
|---|---:|---:|---|
| `04_texto_refundido_Estatuto_Basico…` | 435 | 14,4 % | Estatuto Básico del Empleado Público |
| `03_Gobierno_composicion…` | 435 | 13,9 % | Gobierno |
| `05_Igualdad de Genero…` | 358 | 19,6 % | Igualdad y violencia de género |
| `08_Acceso_electronico_ciudadanos…` | 258 | 24,7 % | Acceso electrónico de los ciudadanos |
| `07_proteccion_datos…` | 242 | 27,2 % | Protección de datos |
| `La_sociedad_informacion…` | 222 | 29,1 % | Sociedad de la información |
| `02_Cortes_Generales…` | 124 | 52,3 % | Cortes Generales |
| `01_Constitucion_Española…` | 106 | 65,1 % | Constitución Española |
| `Instrumentos_para_acceso_electronico…` | 85 | 78,2 % | Instrumentos de acceso electrónico |

El desequilibrio es la clave: el reparto igual por documento (66-68
preguntas) deja a los documentos gordos a la mitad. Con reparto
**proporcional al texto** y fragmentos largos primero, la simulación con
los 2.265 fragmentos útiles da **97,7 % del texto y 98,8 % de las
páginas**, con 85-435 preguntas por tema (mínimo 85). Publicando 2.100
tras los descartes, la estimación es **≥95 % del texto**.

## 2. Diseño

### 2.1 Un solo fichero con tema (decisión 1 + 4 del usuario)

`js/quiz_pool.json` pasa de 4 campos a 5: se añade `"tema"`, con una
etiqueta legible en español. Un único `fetch`, sin manifiesto, sin rutas
nuevas en `server.py` y sin cambios en cómo se sirve el juego.

Alternativa descartada: 9 ficheros, uno por documento. El usuario pidió un
solo fichero y, con un único JSON etiquetado, las cuotas se calculan en el
cliente sin nueve peticiones ni un fichero índice que mantener.

### 2.2 Tema en el generador (`backend/config.py`, `backend/generate_quiz.py`)

- `config.TEMAS_PDF`: lista ordenada de pares
  `(fragmento_distintivo_del_nombre, etiqueta_española)`. El prefijo
  numérico no sirve como clave porque el documento de sociedad de la
  información no lo tiene.
- `config.tema_de_fuente(fuente)`: recibe `"…pdf (pág. N)"` y devuelve la
  etiqueta; si no reconoce el documento, devuelve el nombre del fichero
  sin extensión, sin prefijo numérico y con guiones bajos convertidos en
  espacios. Nunca lanza: el generador no debe romperse por un PDF nuevo.
- `escribir_pool_json()` añade `"tema"` a cada pregunta: si la pregunta ya
  lo trae (repúblicación desde `--mejorar-explicaciones`) se respeta; si
  no, se deriva de `"fuente"`; si tampoco hay fuente, `"tema": "General"`.
- `--desde-cero` (nueva opción de `parse_args`): `main_pool()` ignora
  `logs/pool_cache.json` y empieza de cero. Sin la opción, el
  comportamiento actual (reanudar) no cambia.
- `recortar_equilibrado(pool, cantidad, minimo_por_tema=50)`: si se han
  generado más preguntas de las pedidas, en lugar de `pool[:2000]` (que
  recortaría siempre a los mismos temas, los últimos del round-robin) se
  eliminan al azar de los temas más representados, sin bajar de 50 por
  tema.
- `seleccionar_chunks_para_pool` cambia de raíz:
  - **Cuota proporcional al texto** de cada documento (no una ronda igual
    por PDF), con ajuste fino para que la suma dé exactamente lo pedido.
  - Dentro de cada documento se elige **primero el fragmento más largo de
    cada página** y después se completa con los más largos que queden. Así
    se cubre todo el documento y se maximiza el texto por pregunta.
  - `maximo_por_pdf` sigue disponible como tope opcional, pero por
    defecto no se aplica: el reparto proporcional ya evita que un
    documento acapare el pool.
  - El resultado es determinista (no usa azar), y hay una prueba que
    comprueba que un documento con el triple de texto recibe ~el triple
    de preguntas.
- Con `cantidad * 1.2 = 2.520` se piden más fragmentos de los 2.265
  útiles, así que se usa todo el material disponible.
- `python backend/generate_quiz.py --pool 2100 --desde-cero` deja
  `js/quiz_pool.json` con lo que sobreviva a los descartes (≥1.950).

Coste estimado: **8-10 minutos** de generación, con checkpoint cada 25
preguntas; si se corta, se relanza y continúa.

### 2.3 Verificador y medidor de cobertura (`backend/verificar_pool.py`)

- Mínimo por defecto: **1.900** (la meta es 2.100; el margen absorbe unos
  pocos descartes).
- **Medidor de cobertura**: `cobertura_de_texto(fragmentos, usados)` (pura
  y testeable sin BD) recibe `(id, ruta_pdf, pagina, longitud)` y los
  `contexto_id` de la caché, y devuelve texto % y páginas % globales y por
  documento. El verificador la usa cuando hay BD y `logs/pool_cache.json`;
  si no, avisa de que no puede medir y sigue con el resto de
  comprobaciones. Gate: **≥90 % texto global, ≥85 % por documento, ≥95 %
  páginas**.
- Comprobaciones nuevas:
  - `tema` presente, no vacío y perteneciente a `TEMAS_PDF`.
  - **≥50 preguntas por tema** y reparto impreso en tabla con porcentajes.
  - **Texto en inglés**: lista de palabras function (` the `, ` of `,
    ` and `, ` with `, ` under `, ` shall `, ` protected `, ` must `, ` is `,
    ` are `, ` which `), ignorando mayúsculas y las apariciones dentro de
    nombres propios conocidos. Detecta el caso real que sigue en el pool
    actual («protected under», pregunta 371).
  - **Explicaciones que hablan de «el texto/pasaje/contexto/fragmento»**
    (hoy se corrigieron con `--mejorar-explicaciones`; el verificador debe
    impedir que vuelvan).
  - Duplicados de enunciado y de conjunto de opciones (ya existe) y
    esquema (ya existe).
- Si falta `logs/pool_cache.json`, el reparto por tema se saca del propio
  campo `tema` del pool publicado: el verificador deja de depender de la
  caché para lo esencial.

### 2.4 Selección por cuotas y rotación (`js/app.js`)

Funciones nuevas, todas con el azar como parámetro para poder probarlas:

- `hashPregunta(enunciado)`: FNV-1a de 32 bits en hexadecimal. Estable
  entre sesiones y barato; con 2.000 preguntas la probabilidad de colisión
  es despreciable (≈0,05 %).
- `leerVistas(almacen)`: devuelve `{tamano, hashes}`; si no hay, está
  corrupto o `tamano` no coincide con `banco.length`, devuelve vacío
  (RF7, caso límite 5). Nunca lanza.
- `guardarVistas(almacen, tamano, hashes)`: guarda como máximo 2.500
  hashes; silencioso si el almacenamiento falla.
- `agruparPorTema(banco)`: `Map` tema → preguntas, en orden alfabético de
  tema para que el reparto sea reproducible.
- `elegirPartida(banco, total, azar, vistas)`:
  1. Si hay menos de 2 temas, se comporta como hoy (barajado completo).
  2. `base = floor(total / numeroDeTemas)`, `sobrantes = total - base * n`.
     Con 9 temas: 3 + 3 + 3 + … (27) y 3 libres.
  3. Por cada tema: primero las **no vistas** barajadas, luego las vistas
     barajadas; se toman `base`, descartando las que repiten el texto de
     una opción ya usada en la partida (regla vigente de la spec 002).
  4. Los `sobrantes` se reparten al azar entre los temas, también sin
     opciones repetidas.
  5. Si algún tema no llega a su cuota (caso límite 2), se completa con el
     resto del banco hasta 30.
- `marcarVistas(preguntas)`: añade los hashes de la partida recién
  montada **al empezar**, no al terminar: así dos partidas seguidas no
  comparten nada (RF5) aunque la primera se abandone.
- Reinicio de ciclo (RF7): si las no vistas son menos que `total`, se
  conservan como vistas solo los hashes de la **última partida** y se
  vacía el resto; la siguiente partida empieza un ciclo nuevo sin repetir
  las 30 inmediatamente anteriores.
- Flujo: `botonEmpezar` → `cargarPool()` → `elegirPartida()` →
  `marcarVistas()` → `mezclarPartida()`. Si el banco es el de reserva
  (`quizData`, 30 preguntas fijas) no hay rotación: no habría de dónde
  elegir, y además el pool solo trae temas cuando se ha cargado.

Clave de `localStorage`: `opoquiz-vistas`, JSON
`{"tamano": 2000, "hashes": ["a1b2c3d4", …]}`. Mismo patrón defensivo que
`js/audio.js`: todo dentro de `try/catch`, y si el almacenamiento no
existe se juega sin rotación (RF9).

### 2.5 Qué no cambia

- `js/quiz.js` y `js/quizlib.min.js`: intactos.
- `css/style.css`: no hay interfaz nueva; el tema no se muestra en
  pantalla (decisión de alcance: añadirlo al enunciado o a la revisión
  sería otra spec).
- `backend/server.py`: ya sirve `js/**` y el fichero sigue en `js/`.
- `js/audio.js` y las 10 pruebas de sonido.

### 2.6 Decisiones y alternativas descartadas

| Decisión | Alternativa descartada | Porqué |
|---|---|---|
| Un fichero con `tema` | 9 ficheros por documento | Decisión del usuario; un `fetch` y sin manifiesto |
| Cuotas iguales de preguntas por tema (3 cada uno) | Cuotas proporcionales al número de preguntas del tema | Las preguntas por tema deben ser iguales en cada partida (el jugador ve 3 de cada, siempre); lo que se reparte proporcional al texto es la **generación**, no la partida |
| Reparto de fragmentos proporcional al texto | Ronda igual por documento (hoy) | Dejaba a los documentos gordos al 14 % y a los pequeños al 78 % |
| Cobertura medida en **texto** | Cobertura medida en número de fragmentos | El 11 % de los fragmentos solo tiene el 2,3 % del texto: forzar esos trozos da preguntas malas por casi nada |
| Largos primero, página a página | Solo largos primero | Sin el reparto por páginas, un documento se cubriría solo por sus zonas de fragmentos largos |
| Tema derivado en el generador | Derivarlo en el navegador desde un `id` | La etiqueta ya viaja legible y no hay tabla duplicada en JS |
| Rotación por hash del enunciado | Guardar índices del pool | Los índices cambian al regenerar; el hash es estable |
| `localStorage` | Cookie o servidor | Sin red y coherente con la preferencia de sonido |
| `--desde-cero` explícito | Borrar la caché a mano | Reproducible y sin pasos manuales olvidables |
| Recorte equilibrado | `pool[:2000]` | El recorte simple castigaría a los temas del final del round-robin |
| Mantener `cache: 'no-store'` | Versionar el fichero (`?v=`) | `no-store` es correcto siempre; versionar exige mantener una constante a mano en cada regeneración |

### 2.7 Riesgos

1. **Calidad**: 2.000 preguntas estiran el corpus; parte saldrá de tablas o
   índices. Mitigación: muestreo del 10 % revisado a mano, verificación de
   duplicados, de inglés y de explicaciones, y el descarte que ya hace el
   generador (chunks <250, opciones de longitud desigual).
2. **Tiempo**: 8-10 min de generación más posibles reintentos. Si se corta,
   la caché permite continuar.
3. **Peso**: ~2,1 MB sin comprimir y sin caché HTTP. Medir la carga; si
   supera 150 ms en local, se reconsidera `no-store`.
4. **Truncado**: si se generan >2.000, el recorte equilibrado debe dejar
   ≥50 por tema; lo comprueba el verificador.
5. **Pruebas de rotación**: no deben depender del orden exacto (el azar no
   se siembra); se comprueban propiedades: cuotas, disyunción entre
   partidas, reinicio de ciclo.
6. **Regresión del fallback**: con un pool antiguo (sin `tema`) todo debe
   seguir jugándose; hay prueba específica.
7. **Techo de material**: para publicar 2.100 hacen falta ≥2.100 de los
   2.265 fragmentos útiles, o sea un máximo del 7 % de descartes. Si la
   generación se queda corta, el gate admite ≥1.950 **pero** la cobertura
   de texto debe seguir ≥90 % (se mide sobre el pool real, no sobre el
   objetivo).

## 3. Estrategia de pruebas

Nuevas (~11) en `tests/pool.spec.js` y un fichero nuevo
`tests/tematico.spec.js`:

| # | Prueba | RF |
|---|---|---|
| 1 | El pool real tiene ≥1.900 preguntas | RF1 |
| 2 | Todas traen `tema` de la lista conocida y hay 9 temas | RF2, RF3 |
| 3 | Cada tema tiene ≥50 preguntas | RF3 |
| 4 | Una partida tiene 30 preguntas y ≥3 de cada tema | RF4 |
| 5 | Dos partidas seguidas no comparten preguntas | RF5 |
| 6 | Se guardan las vistas en `localStorage` con el tamaño del pool | RF6 |
| 7 | La tercera partida de un fixture de 90 reinicia el ciclo sin repetir las 30 últimas | RF7 |
| 8 | Sin `localStorage` (bloqueado) se juega igual: 30 preguntas, sin errores | RF9 |
| 9 | Un pool sin `tema` se juega como hoy, sin cuotas | RF9 |
| 10 | El verificador rechaza inglés, duplicados y un tema con <50 | RF11 |
| 11 | El pool se descarga en una sola petición | RF10 |
| 12 | Un documento con el triple de texto recibe ~el triple de fragmentos | RF14 |
| 13 | El medidor de cobertura da ≥90 % de texto con un conjunto sintético | RF13 |

Fixture: `tests/fixtures/pool.js` gana `construirPoolPorTemas(nTemas,
porTema)`; las preguntas llevan `tema: "Tema N"` y textos únicos.

Actualizaciones: el mínimo de `tests/pool.spec.js` pasa de 500 a 1.900;
`tests/fixtures/pool.js` sigue sirviendo el pool pequeño sin temas para
las pruebas de comportamiento general.

## 4. Criterios de aceptación (gate de cierre)

1. `python backend/generate_quiz.py --pool 2100 --desde-cero` termina y
   deja `js/quiz_pool.json` con **≥1.950 preguntas**.
2. `python backend/verificar_pool.py` imprime **0 problemas** y una tabla
   con los 9 temas, todos con ≥50 preguntas.
3. El pool no tiene enunciados repetidos, ni conjuntos de opciones
   repetidos, ni texto en inglés, ni explicaciones con «el texto».
4. **Cobertura medida ≥90 % del texto**, ≥85 % por documento y ≥95 % de
   las páginas, comprobada por el verificador contra la BD.
5. Medido en el navegador: cada partida tiene **30 preguntas y ≥3 de cada
   tema**; dos partidas seguidas no comparten ninguna mientras queden no
   vistas.
6. Sin `localStorage` la partida se juega igual y la consola no muestra
   errores.
7. `npx playwright test` en verde (**~58 pruebas**).
8. Carga del pool medida (<150 ms en local) y una sola petición.
9. README y MEMORY actualizados con las cifras reales (2.100, 90 % de
   texto, 9 temas, cuotas y rotación).

## 5. Reparto de trabajo

| Fase | Agente | Entrega |
|---|---|---|
| 1 | Implementer | Tema en el generador + `--desde-cero` (tareas 1-2) |
| 2 | Implementer | Regenerar el pool y verificarlo (tarea 3) |
| 3 | Implementer | Verificador ampliado (tarea 4) |
| 4 | Implementer | Cuotas y rotación en `js/app.js` (tareas 5-6) |
| 5 | Implementer | Pruebas (tareas 7-8) |
| 6 | Implementer | Documentación (tarea 9) |
| 7 | Reviewer | Veredicto contra los criterios de aceptación |
