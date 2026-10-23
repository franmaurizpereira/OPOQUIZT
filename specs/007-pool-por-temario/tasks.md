# Tareas 007 — Pool de 2.000 preguntas etiquetado por temario

- [x] **1. Tema en el pool publicado** (RF2)
      `backend/config.py`: `TEMAS_PDF` (9 pares nombre distintivo →
      etiqueta en español) y `tema_de_fuente(fuente)` con vuelta atrás
      para documentos desconocidos.
      `backend/generate_quiz.py`: `escribir_pool_json()` añade `"tema"`
      (respeta el que ya venga, si no lo deriva de `"fuente"`, y si no hay
      fuente pone `"General"`).
      Hecho cuando: un pool de prueba con `fuente` de los 9 documentos
      sale con 9 etiquetas distintas y sin excepciones con un nombre
      desconocido. **Hecho:** coincidencia por prefijo del nombre (el PDF
      de Gobierno menciona las Cortes y se confundía), 3 pruebas nuevas,
      `backend/test_pool.py` en 43/43.

- [x] **2. Regeneración desde cero y recorte equilibrado** (RF1, RF3, RF14)
      `--desde-cero` en `parse_args`/`main_pool` (ignora
      `logs/pool_cache.json`). `recortar_equilibrado(pool, cantidad,
      minimo_por_tema=50)` en lugar de `pool[:cantidad]`.
      Hecho cuando: `--desde-cero` no lee la caché anterior y el recorte
      deja ≥50 preguntas por tema (probado con una lista sintética de
      2.400). **Hecho**, más la selección proporcional al texto y los
      largos primero: con los 2.265 fragmentos reales da 9 temas, 85-435
      preguntas por tema, **97,7 % del texto y 98,8 % de las páginas**. 7
      pruebas nuevas.

- [ ] **3. Generar el pool de 2.100** (RF1, RF3, RF14)
      Ejecutar `python backend/generate_quiz.py --pool 2100` (reanuda
      desde la caché: ya hay 633 preguntas generadas) y después
      `python backend/generate_quiz.py --mejorar-explicaciones`, porque el
      modelo nuevo escribe «el texto» en el 73 % de las explicaciones (la
      versión anterior se reescribió a mano una vez y por eso no las
      tenía). Revisar después una muestra del 10 %.
      Hecho cuando: `js/quiz_pool.json` tiene ≥1.950 preguntas, los 9
      temas, 85-435 por tema, sin fugas de inglés y sin «el texto» en las
      explicaciones.
      **Bloqueada:** la cuenta de OpenRouter **nunca ha comprado
      créditos** (402: «Insufficient credits»). La prueba gratuita se
      agotó con 0,20 $ y 743 preguntas generadas, que están en la caché
      para reanudar. DeepSeek Flash es el modelo más barato que responde
      (~0,15 $ para el resto); el gratuito invierte la opción correcta.
      Mientras tanto `js/quiz_pool.json` se ha restaurado a las 600
      preguntas que funcionaban.

- [ ] **4. Verificador y medidor de cobertura** (RF11, RF13)
      `backend/verificar_pool.py`: mínimo 1.900, `tema` obligatorio y
      conocido, ≥50 por tema con tabla, detector de inglés, detector de
      «el texto/pasaje/contexto/fragmento», y reparto por tema sin
      depender de la caché. Añadir `cobertura_de_texto(fragmentos,
      usados)` (pura, sin BD) y el informe de cobertura por documento.
      Hecho cuando: da 0 problemas con el pool nuevo, imprime ≥90 % de
      texto, ≥85 % por documento y ≥95 % de páginas, y devuelve problemas
      con un pool de prueba que tenga inglés, un duplicado y un tema con
      20 preguntas.

- [ ] **5. Cuotas por tema en el frontend** (RF4, RF9)
      `js/app.js`: `preguntaValida()` acepta `tema` opcional;
      `agruparPorTema()` y `elegirPartida(banco, total, azar, vistas)` con
      cuota base `floor(30 / nTemas)` y sobrantes al azar. Pool sin temas
      o con menos de 2 temas → comportamiento actual.
      Hecho cuando: con un pool de 9 temas cada partida tiene 30 preguntas
      y ≥3 de cada tema; con el pool sin `tema` siguen saliendo 30 y sin
      errores.

- [ ] **6. Rotación de preguntas vistas** (RF5, RF6, RF7)
      `hashPregunta()`, `leerVistas()`, `guardarVistas()`,
      `marcarVistas()` en `js/app.js`; clave `opoquiz-vistas`, tamaño del
      pool guardado, reinicio de ciclo conservando las 30 últimas, todo
      dentro de `try/catch`.
      Hecho cuando: dos partidas seguidas no comparten preguntas, el
      ciclo se reinicia al agotarse, un almacenamiento bloqueado no rompe
      la partida y un cambio de tamaño del pool descarta las vistas.

- [ ] **7. Pruebas nuevas** (RF1-RF11)
      `tests/tematico.spec.js` y ampliación de `tests/pool.spec.js` con
      las 11 pruebas del plan; `tests/fixtures/pool.js` gana
      `construirPoolPorTemas(nTemas, porTema)`.
      Hecho cuando: las 11 pruebas pasan y ninguna depende del orden
      exacto de las preguntas.

- [ ] **8. Ajustar las pruebas existentes** (RF1, RF9)
      Mínimo del pool real de 500 a 1.900; revisar que el fixture general
      sigue sirviendo para las pruebas de comportamiento.
      Hecho cuando: `npx playwright test` pasa entero (~58 pruebas) y las
      45 anteriores siguen verdes.

- [ ] **9. Documentación** (RF12)
      README (cifras reales, cuotas, rotación, cobertura, cómo regenerar
      con `--desde-cero`), `MEMORY.md` (decisión y datos), `AGENTS.md` §7
      si el gate cambia, y esta spec marcada como implementada.
      Hecho cuando: no queda ninguna cifra de 600 preguntas ni de «pool
      de 600» en la documentación, el README explica la cobertura del
      90 % y que cada tema sale 3 veces como mínimo.

- [ ] **10. Gate de cierre** (todos)
      Verificación completa: `python backend/verificar_pool.py`,
      `python -m py_compile backend/*.py`, `node --check js/*.js`,
      `npx playwright test`, carga del pool medida en el navegador y una
      sola petición del fichero.
      Hecho cuando: todo en verde y el Reviewer emite **VEREDICTO:
      APROBADO** contra los criterios de aceptación del plan.
