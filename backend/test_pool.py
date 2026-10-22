"""Pruebas unitarias del backend (bucle de generación del pool).

Se ejecutan sin dependencias externas y sin necesidad de Ollama ni de la
base de datos: el modelo se simula con respuestas falsas.

    .venv/bin/python backend/test_pool.py
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config
import generate_quiz as g
import historial


def fragmentos_de_prueba(num_pdf=9, por_pdf=300, longitud=400, prefijo="doc"):
    """Crea un conjunto de fragmentos sintéticos repartido en varios PDF."""
    fragmentos = []
    identificador = 1
    for numero in range(num_pdf):
        for indice in range(por_pdf):
            fragmentos.append(
                {
                    "id": identificador,
                    "ruta_pdf": f"/pdfs/{prefijo}{numero + 1}.pdf",
                    "pagina": indice // 3 + 1,
                    "tipo": "texto",
                    "contenido": f"Contenido de ejemplo número {indice} " * (longitud // 30),
                }
            )
            identificador += 1
    return fragmentos


def respuesta_falsa(fragmento, numero=0):
    """Construye una respuesta del LLM con una pregunta válida."""
    return json.dumps(
        [
            {
                "contexto": 1,
                "pregunta": f"¿Qué establece el artículo {fragmento['id']} sobre el "
                f"contenido número {numero} del documento?",
                "opciones": [
                    f"Que el contenido número {numero} regulado en el artículo {fragmento['id']}",
                    f"Que el artículo {fragmento['id']} no regula el contenido {numero}",
                    f"Que el contenido {numero} se aplica a otros artículos distintos",
                    f"Que el artículo {fragmento['id']} deroga el contenido {numero}",
                ],
                "correcta": 0,
                "explicacion": (
                    f"Porque el artículo {fragmento['id']} recoge expresamente el "
                    f"contenido número {numero} del documento de origen."
                ),
            }
        ]
    )


class RespuestaSimulada:
    """Sustituye al LLM por una respuesta preparada de antemano."""

    def __init__(self, generador):
        self.generador = generador
        self.llamadas = 0

    def __call__(self, prompt, modelo=None, formato="json"):
        self.llamadas += 1
        return self.generador(self.llamadas)


class TestSeleccionChunksParaPool(unittest.TestCase):
    """Comprueba el reparto equilibrado de fragmentos del pool."""

    def test_ningun_pdf_supera_el_tope_del_30_por_ciento(self):
        """Con 9 PDF y 1000 preguntas ningún PDF supera el 30 % de los fragmentos."""
        fragmentos = fragmentos_de_prueba(num_pdf=9, por_pdf=300)
        elegidos = g.seleccionar_chunks_para_pool(fragmentos, 1000)

        self.assertEqual(len(elegidos), 1000)

        por_pdf = {}
        for frag in elegidos:
            por_pdf[frag["ruta_pdf"]] = por_pdf.get(frag["ruta_pdf"], 0) + 1

        for pdf, cuantos in por_pdf.items():
            self.assertLessEqual(
                cuantos,
                300,
                f"El PDF {pdf} aporta {cuantos} fragmentos (tope: 300)",
            )

    def test_todos_los_pdf_participan(self):
        """Con fragmentos de sobra, los 9 PDF aportan al menos una pregunta."""
        fragmentos = fragmentos_de_prueba(num_pdf=9, por_pdf=300)
        elegidos = g.seleccionar_chunks_para_pool(fragmentos, 1000)

        por_pdf = {frag["ruta_pdf"] for frag in elegidos}
        self.assertEqual(len(por_pdf), 9)

    def test_seleccion_determinista(self):
        """Con la misma semilla la selección es siempre la misma."""
        fragmentos = fragmentos_de_prueba(num_pdf=9, por_pdf=300)

        primera = g.seleccionar_chunks_para_pool(fragmentos, 1000)
        segunda = g.seleccionar_chunks_para_pool(fragmentos, 1000)

        self.assertEqual(
            [f["id"] for f in primera],
            [f["id"] for f in segunda],
            "La selección debe ser reproducible con semilla fija",
        )

    def test_semilla_distinta_cambia_el_orden(self):
        """Cambiar la semilla cambia el orden, pero no el reparto por PDF."""
        fragmentos = fragmentos_de_prueba(num_pdf=9, por_pdf=300)

        primera = g.seleccionar_chunks_para_pool(fragmentos, 500, semilla=1)
        segunda = g.seleccionar_chunks_para_pool(fragmentos, 500, semilla=2)

        self.assertNotEqual(
            [f["id"] for f in primera],
            [f["id"] for f in segunda],
            "Con semillas distintas el resultado debe cambiar",
        )

    def test_no_hay_fragmentos_repetidos(self):
        """Un mismo fragmento no se selecciona dos veces."""
        fragmentos = fragmentos_de_prueba(num_pdf=9, por_pdf=300)
        elegidos = g.seleccionar_chunks_para_pool(fragmentos, 1000)

        identificadores = [f["id"] for f in elegidos]
        self.assertEqual(len(identificadores), len(set(identificadores)))

    def test_pdf_dominante_no_ahoga_al_resto(self):
        """Un PDF con muchísimos fragmentos no puede acaparar el pool."""
        fragmentos = fragmentos_de_prueba(num_pdf=8, por_pdf=50)
        # Se añade un PDF gigante
        identificador = 10000
        for indice in range(3000):
            fragmentos.append(
                {
                    "id": identificador,
                    "ruta_pdf": "/pdfs/dominante.pdf",
                    "pagina": indice // 3 + 1,
                    "tipo": "texto",
                    "contenido": "Contenido dominante " * 15,
                }
            )
            identificador += 1

        elegidos = g.seleccionar_chunks_para_pool(fragmentos, 1000)
        dominantes = [f for f in elegidos if f["ruta_pdf"] == "/pdfs/dominante.pdf"]

        # El tope del 30 % se respeta siempre: 300 de 1000
        self.assertLessEqual(len(dominantes), 300)
        # Con el tope estricto pueden quedar huecos: 8 PDF pequeños (50 cada
        # uno) más 300 del dominante = 700 fragmentos.
        self.assertEqual(len(elegidos), 700)

    def test_pocos_fragmentos_devuelve_lo_que_hay(self):
        """Si no hay suficientes fragmentos, se devuelven todos los posibles."""
        fragmentos = fragmentos_de_prueba(num_pdf=2, por_pdf=5)
        elegidos = g.seleccionar_chunks_para_pool(fragmentos, 100)

        self.assertEqual(len(elegidos), 10)

    def test_sin_fragmentos_devuelve_lista_vacia(self):
        """Sin fragmentos en la base de datos no se selecciona nada."""
        self.assertEqual(g.seleccionar_chunks_para_pool([], 100), [])


class TestGenerarPreguntaDesdeChunk(unittest.TestCase):
    """Comprueba la generación de una pregunta suelta a partir de un fragmento."""

    def setUp(self):
        self.original = g._llamar_llm

    def tearDown(self):
        g._llamar_llm = self.original

    def test_genera_una_pregunta_valida(self):
        """Con una respuesta buena del LLM se obtiene una pregunta validada."""
        fragmento = fragmentos_de_prueba(1, 1)[0]
        g._llamar_llm = RespuestaSimulada(
            lambda n: respuesta_falsa(fragmento, n)
        )

        pregunta = g.generar_pregunta_desde_chunk(fragmento)

        self.assertIsNotNone(pregunta)
        self.assertEqual(len(pregunta["opciones"]), 4)
        self.assertIn(pregunta["correcta"], range(4))
        self.assertTrue(pregunta["explicacion"])
        self.assertEqual(pregunta["contexto_id"], fragmento["id"])

    def test_reintenta_hasta_tres_veces(self):
        """Si el LLM falla, se reintenta hasta 3 veces por fragmento."""
        fragmento = fragmentos_de_prueba(1, 1)[0]
        simulador = RespuestaSimulada(lambda n: "esto no es json")
        g._llamar_llm = simulador

        pregunta = g.generar_pregunta_desde_chunk(fragmento)

        self.assertIsNone(pregunta)
        self.assertEqual(simulador.llamadas, 3)

    def test_descarta_preguntas_invalidas(self):
        """Una pregunta sin explicación suficiente se descarta."""
        fragmento = fragmentos_de_prueba(1, 1)[0]
        g._llamar_llm = RespuestaSimulada(
            lambda n: json.dumps(
                [
                    {
                        "contexto": 1,
                        "pregunta": "¿Qué dice el texto?",
                        "opciones": ["a", "b", "c", "d"],
                        "correcta": 0,
                        "explicacion": "corta",
                    }
                ]
            )
        )

        self.assertIsNone(g.generar_pregunta_desde_chunk(fragmento))

    def test_error_del_llm_no_rompe_el_bucle(self):
        """Si Ollama lanza una excepción, se reintenta y se acaba devolviendo None."""

        def que_falla(prompt, modelo=None, formato="json"):
            raise RuntimeError("Ollama no responde")

        g._llamar_llm = que_falla
        fragmento = fragmentos_de_prueba(1, 1)[0]

        self.assertIsNone(g.generar_pregunta_desde_chunk(fragmento))


class TestDeduplicarPool(unittest.TestCase):
    """Comprueba que el pool no guarda preguntas repetidas."""

    def _pregunta(self, enunciado, opciones, correcta=0):
        return {
            "pregunta": enunciado,
            "opciones": list(opciones),
            "correcta": correcta,
            "explicacion": "Explicación de prueba suficientemente larga para pasar la validación.",
            "contexto_id": 1,
            "fuente": "doc.pdf (pág. 1)",
        }

    def test_elimina_el_enunciado_repetido(self):
        """Dos preguntas con el mismo enunciado se quedan en una."""
        a = self._pregunta("Enunciado idéntico", ["uno", "dos", "tres", "cuatro"])
        b = self._pregunta("Enunciado idéntico", ["cinco", "seis", "siete", "ocho"])
        c = self._pregunta("Otro enunciado distinto", ["nueve", "diez", "once", "doce"])

        resultado = g.deduplicar_pool([a, b, c])

        self.assertEqual(len(resultado), 2)

    def test_elimina_las_mismas_opciones(self):
        """Dos preguntas con el mismo conjunto de opciones son la misma."""
        a = self._pregunta("Primera redacción", ["uno", "dos", "tres", "cuatro"])
        b = self._pregunta("Segunda redacción totalmente diferente", ["uno", "dos", "tres", "cuatro"])
        c = self._pregunta("Tercera redacción", ["nueve", "diez", "once", "doce"])

        resultado = g.deduplicar_pool([a, b, c])

        self.assertEqual(len(resultado), 2)

    def test_conserva_preguntas_distintas(self):
        """Preguntas de verdad distintas se conservan todas."""
        preguntas = [
            self._pregunta("Primera pregunta", ["uno", "dos", "tres", "cuatro"]),
            self._pregunta("Segunda pregunta", ["cinco", "seis", "siete", "ocho"]),
            self._pregunta("Tercera pregunta", ["nueve", "diez", "once", "doce"]),
        ]

        resultado = g.deduplicar_pool(preguntas)

        self.assertEqual(len(resultado), 3)


class TestReanudacionDelPool(unittest.TestCase):
    """Si la generación se corta, al relanzarla se continúa sin repetir."""

    def setUp(self):
        self.directorio = tempfile.TemporaryDirectory()
        self.ruta_cache = Path(self.directorio.name) / "pool_cache.json"
        self.ruta_pool = Path(self.directorio.name) / "quiz_pool.json"
        self.originales = {
            "llm": g._llamar_llm,
            "seleccion": g.seleccionar_chunks_para_pool,
            "cargar": g.cargar_fragmentos,
            "conexion": g.config.conexion,
            "escribir": g.escribir_pool_json,
            "guardar": g.guardar_cache,
            "ruta_cache": g.config.RUTA_CACHE_POOL,
            "checkpoint": g.CHECKPOINT_CADA,
            "pool": g.generar_preguntas_pool,
        }
        g.config.RUTA_CACHE_POOL = self.ruta_cache
        # Se guarda en cada lote, para que el corte simulado deje algo
        # guardado en la caché
        g.CHECKPOINT_CADA = 1

    def tearDown(self):
        g._llamar_llm = self.originales["llm"]
        g.seleccionar_chunks_para_pool = self.originales["seleccion"]
        g.cargar_fragmentos = self.originales["cargar"]
        g.config.conexion = self.originales["conexion"]
        g.escribir_pool_json = self.originales["escribir"]
        g.guardar_cache = self.originales["guardar"]
        g.config.RUTA_CACHE_POOL = self.originales["ruta_cache"]
        g.CHECKPOINT_CADA = self.originales["checkpoint"]
        g.generar_preguntas_pool = self.originales["pool"]
        self.directorio.cleanup()

    def _preparar(self):
        """Simula la base de datos, la selección y el modelo.

        Cada fragmento produce una pregunta de verdad distinta: para el
        jugador son preguntas diferentes y la deduplicación no debe
        confundirlas. Se usan palabras únicas por fragmento (`materiaN`,
        `reglaN`) tanto en el enunciado como en el texto de origen, porque la
        validación exige que la pregunta esté respaldada por el fragmento.
        """
        import re

        def respuesta(identificador):
            marca = f"materia{identificador}"
            regla = f"regla{identificador}"
            enunciado = (
                f"¿Qué dispone el artículo {identificador} sobre la {marca} "
                f"y la {regla}?"
            )
            correcta = (
                f"Que la {marca} se regula por la {regla} según el artículo "
                f"{identificador}"
            )
            return json.dumps(
                [
                    {
                        "contexto": 1,
                        "pregunta": enunciado,
                        "opciones": [
                            correcta,
                            f"Que la {marca} se deroga por la {regla} conforme al artículo {identificador}",
                            f"Que la {marca} se remite a la {regla} del artículo {identificador}",
                            f"Que la {marca} se declara fuera de la {regla} en el artículo {identificador}",
                        ],
                        "correcta": 0,
                        "explicacion": (
                            f"Porque el artículo {identificador} dispone sobre la "
                            f"{marca} que la {regla} se aplica en general, tal "
                            "como consta en su texto."
                        ),
                    }
                ]
            )

        def lllm(prompt, modelo=None, formato="json", num_ctx=8192):
            # El prompt lleva todos los contextos del lote: seSacan los
            # identificadores de cada fragmento y se devuelve una pregunta
            # por cada uno, en el mismo orden.
            identificadores = []
            for numero in re.findall(r"artículo (\d+)", prompt):
                if numero not in identificadores:
                    identificadores.append(numero)
            if not identificadores:
                identificadores = ["1"]

            preguntas = []
            for posicion, identificador in enumerate(identificadores, start=1):
                preguntas.append(json.loads(respuesta(int(identificador)))[0])
                preguntas[-1]["contexto"] = posicion
            return json.dumps(preguntas)

        g._llamar_llm = lllm
        g.seleccionar_chunks_para_pool = lambda fragmentos, n, **kw: fragmentos[:n]

        class ConexionFalsa:
            def close(self):
                pass

        g.config.conexion = lambda: ConexionFalsa()
        g.cargar_fragmentos = lambda conn: [
            {
                "id": i + 1,
                "ruta_pdf": f"/p/{i % 9}.pdf",
                "pagina": i // 3 + 1,
                "tipo": "texto",
                "contenido": (
                    f"El artículo {i + 1} dispone sobre la materia{i + 1} que la "
                    f"regla{i + 1} se aplica en general al ámbito del órgano. " * 10
                ),
            }
            for i in range(100)
        ]
        g.escribir_pool_json = lambda preguntas, ruta=self.ruta_pool: Path(
            ruta
        ).write_text(
            json.dumps(
                [
                    {
                        "pregunta": p["pregunta"],
                        "opciones": list(p["opciones"]),
                        "correcta": p["correcta"],
                        "explicacion": p["explicacion"],
                    }
                    for p in preguntas
                ],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        g.guardar_cache = lambda preguntas, ruta=self.ruta_cache: Path(ruta).write_text(
            json.dumps(
                g.deduplicar(g.cargar_cache(ruta) + list(preguntas)),
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    def test_reanuda_tras_un_corte(self):
        """Al relanzar continúa desde la caché y no repite fragmentos."""
        self._preparar()

        original = g.generar_preguntas_pool

        def que_corta(contextos, **kwargs):
            # Se genera el primer lote y luego se simula un corte (Ctrl+C)
            if len(contextos) > 6:
                original(contextos[:6], **kwargs)
                raise KeyboardInterrupt("corte simulado")
            return original(contextos, **kwargs)

        g.generar_preguntas_pool = que_corta
        with self.assertRaises(KeyboardInterrupt):
            g.main_pool(40)

        # Tras el corte queda lo generado hasta ese momento
        self.assertGreater(len(g.cargar_cache(self.ruta_cache)), 0)

        # Al relanzar, la generación continúa hasta el objetivo
        g.generar_preguntas_pool = original
        g.main_pool(40)

        datos = json.loads(self.ruta_pool.read_text(encoding="utf-8"))
        self.assertEqual(len(datos), 40)
        # Ningún enunciado se repite: cada fragmento dio una pregunta propia
        enunciados = [p["pregunta"] for p in datos]
        self.assertEqual(len(enunciados), len(set(enunciados)))


class TestEsquemaDelPool(unittest.TestCase):
    """El pool publicado tiene el mismo esquema que `quizData`."""

    def setUp(self):
        self.directorio = tempfile.TemporaryDirectory()
        self.ruta = Path(self.directorio.name) / "quiz_pool.json"

    def tearDown(self):
        self.directorio.cleanup()

    def test_campos_exactos_del_esquema(self):
        """Cada pregunta tiene solo los cuatro campos que usa el quiz."""
        pregunta = {
            "pregunta": "¿Qué dispone el artículo 12 del cuerpo normativo?",
            "opciones": ["uno", "dos", "tres", "cuatro"],
            "correcta": 0,
            "explicacion": "Explicación suficientemente larga para la validación.",
            "contexto_id": 12,
            "fuente": "doc.pdf (pág. 3)",
        }
        g.escribir_pool_json([pregunta], self.ruta)

        datos = json.loads(self.ruta.read_text(encoding="utf-8"))
        self.assertIsInstance(datos, list)
        self.assertEqual(
            set(datos[0]),
            {"pregunta", "opciones", "correcta", "explicacion"},
            "El pool debe tener los mismos campos que quizData",
        )

    def test_es_array_json_valido(self):
        """El fichero es un array JSON que se puede leer tal cual."""
        g.escribir_pool_json(
            [
                {
                    "pregunta": f"Pregunta {i}",
                    "opciones": ["a", "b", "c", "d"],
                    "correcta": 1,
                    "explicacion": "Explicación suficientemente larga.",
                    "contexto_id": i,
                }
                for i in range(5)
            ],
            self.ruta,
        )
        datos = json.loads(self.ruta.read_text(encoding="utf-8"))
        self.assertEqual(len(datos), 5)
        self.assertTrue(all(len(p["opciones"]) == 4 for p in datos))
        self.assertTrue(all(0 <= p["correcta"] <= 3 for p in datos))

    def test_no_deja_fichero_temporal(self):
        """La escritura es atómica: no queda ningún .tmp suelto."""
        g.escribir_pool_json([], self.ruta)
        self.assertFalse(self.ruta.with_suffix(".tmp").exists())
        self.assertTrue(self.ruta.exists())


class TestCacheDelPool(unittest.TestCase):
    """La caché del pool es propia y se fusiona, nunca se sobrescribe."""

    def setUp(self):
        self.directorio = tempfile.TemporaryDirectory()
        self.ruta = Path(self.directorio.name) / "pool_cache.json"

    def tearDown(self):
        self.directorio.cleanup()

    def _pregunta(self, identificador):
        # Cada pregunta debe tener un texto realmente distinto: si solo
        # cambia un número, el validador las considera la misma.
        temas = [
            "el plazo para resolver el procedimiento administrativo",
            "la competencia del órgano de contratación pública",
            "el régimen de inherencia del cuerpo de funcionarios",
            "la convalidación de los acuerdos del Consejo de Ministros",
            "el procedimiento de selección de personal temporal",
        ]
        tema = temas[identificador % len(temas)]
        sufijo = f" artículo {identificador} del cuerpo normativo"
        return {
            "pregunta": f"¿Qué regula{sufijo} respecto a {tema}?",
            "opciones": [
                f"Regula {tema}{sufijo} de forma expresa",
                f"No menciona {tema} en ningun caso",
                f"Delega {tema} en las comunidades autónomas",
                f"Deroga {tema} con efectos desde la entrada en vigor",
            ],
            "correcta": 0,
            "explicacion": "Explicación de prueba suficientemente larga para pasar la validación.",
            "contexto_id": identificador,
            "fuente": "doc.pdf (pág. 1)",
        }

    def test_guarda_y_recupera(self):
        """Lo guardado se recupera tal cual."""
        g.guardar_cache([self._pregunta(1)], self.ruta)
        recuperada = g.cargar_cache(self.ruta)
        self.assertEqual(len(recuperada), 1)
        self.assertEqual(recuperada[0]["contexto_id"], 1)

    def test_fusiona_sin_sobrescribir(self):
        """Una escritura posterior conserva lo que ya había."""
        g.guardar_cache([self._pregunta(1)], self.ruta)
        g.guardar_cache([self._pregunta(2)], self.ruta)
        recuperada = g.cargar_cache(self.ruta)
        identificadores = {p["contexto_id"] for p in recuperada}
        self.assertEqual(identificadores, {1, 2})

    def test_no_toca_la_cache_del_modo_normal(self):
        """La caché del pool y la del modo normal son ficheros distintos."""
        self.assertNotEqual(config.RUTA_CACHE_POOL, g.FICHERO_CACHE)
        self.assertTrue(str(config.RUTA_CACHE_POOL).endswith("pool_cache.json"))
        self.assertTrue(str(g.FICHERO_CACHE).endswith("preguntas_cache.json"))

    def test_fichero_inexistente_devuelve_lista_vacia(self):
        """Si no hay caché, se devuelve una lista vacía."""
        self.assertEqual(g.cargar_cache(self.ruta), [])

    def test_fichero_corrupto_devuelve_lista_vacia(self):
        """Si la caché está corrupta, no se rompe: se devuelve vacío."""
        self.ruta.write_text("{esto no es json", encoding="utf-8")
        self.assertEqual(g.cargar_cache(self.ruta), [])


class TestDetalleDelHistorial(unittest.TestCase):
    """El detalle de la partida (la revisión) se guarda y se valida."""

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.ruta = Path(self.dir.name) / "partidas.json"
        self.anterior = historial.RUTA_HISTORIAL
        historial.RUTA_HISTORIAL = self.ruta

    def tearDown(self):
        historial.RUTA_HISTORIAL = self.anterior
        self.dir.cleanup()

    def _detalle(self, **cambios):
        pregunta = {
            "pregunta": "¿Qué dice el artículo 1?",
            "opciones": ["A) Una", "B) Dos", "C) Tres", "D) Cuatro"],
            "correcta": 1,
            "elegida": 2,
            "acertada": False,
            "contestada": True,
            "explicacion": "Porque el artículo 1 dice una cosa y no otra.",
        }
        pregunta.update(cambios)
        return [pregunta]

    def test_valida_un_detalle_correcto(self):
        detalle = historial.validar_detalle(self._detalle())
        self.assertIsNotNone(detalle)
        self.assertEqual(len(detalle), 1)
        self.assertEqual(detalle[0]["correcta"], 1)
        self.assertEqual(detalle[0]["elegida"], 2)
        self.assertFalse(detalle[0]["acertada"])

    def test_rechaza_un_detalle_mal_formado(self):
        self.assertIsNone(historial.validar_detalle("no soy una lista"))
        self.assertIsNone(historial.validar_detalle([{"pregunta": ""}]))
        self.assertIsNone(historial.validar_detalle(self._detalle(correcta=9)))
        self.assertIsNone(
            historial.validar_detalle(self._detalle(opciones=["A", "B"]))
        )

    def test_acepta_una_lista_vacia(self):
        self.assertEqual(historial.validar_detalle([]), [])

    def test_guarda_y_recupera_el_detalle(self):
        historial.guardar_partida(20, 10, self._detalle())
        partidas = historial.leer_partidas()
        self.assertEqual(len(partidas), 1)
        self.assertEqual(len(partidas[0]["detalle"]), 1)
        self.assertEqual(partidas[0]["detalle"][0]["correcta"], 1)

    def test_guarda_sin_detalle(self):
        historial.guardar_partida(20, 10)
        partidas = historial.leer_partidas()
        self.assertEqual(len(partidas), 1)
        self.assertNotIn("detalle", partidas[0])

    def test_poda_el_detalle_de_las_partidas_antiguas(self):
        for _ in range(historial.MAXIMO_CON_DETALLE + 3):
            historial.guardar_partida(20, 10, self._detalle())

        partidas = historial.leer_partidas()
        self.assertEqual(len(partidas), historial.MAXIMO_CON_DETALLE + 3)

        # Las más recientes conservan el detalle
        con_detalle = [p for p in partidas if "detalle" in p]
        self.assertEqual(len(con_detalle), historial.MAXIMO_CON_DETALLE)

        # Las antiguas lo pierden, pero siguen ahí con su puntuación
        sin_detalle = [p for p in partidas if "detalle" not in p]
        self.assertEqual(len(sin_detalle), 3)
        for partida in sin_detalle:
            self.assertIn("aciertos", partida)
            self.assertIn("fecha", partida)


class TestValidarExplicaciones(unittest.TestCase):
    """La validación de las explicaciones reescritas (spec 004, RF6)."""

    def test_detecta_las_explicaciones_que_no_se_entienden_solas(self):
        self.assertTrue(
            g._explicacion_necesita_reescritura(
                {"explicacion": "El pasaje cita la Ley 39/2015."}
            )
        )
        self.assertTrue(
            g._explicacion_necesita_reescritura(
                {"explicacion": "Según el texto, la opción es correcta."}
            )
        )
        self.assertFalse(
            g._explicacion_necesita_reescritura(
                {"explicacion": "La Ley 39/2015 regula el procedimiento."}
            )
        )

    def test_una_explicacion_valida_pasa_la_validacion(self):
        buena = (
            "La Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo "
            "Común, regula en su título primero los derechos de los "
            "interesados en el procedimiento administrativo."
        )
        self.assertTrue(g._explicacion_valida(buena, "¿Qué regula la Ley 39/2015?"))

    def test_se_rechazan_las_explicaciones_cortas_o_largas(self):
        self.assertFalse(g._explicacion_valida("Corta.", "Enunciado"))
        self.assertFalse(g._explicacion_valida("x" * 700, "Enunciado"))

    def test_se_rechazan_las_explicaciones_que_hablan_del_texto(self):
        mala = (
            "El texto de la Ley 39/2015 establece que los interesados tienen "
            "derecho a la información que obra en poder del órgano."
        )
        self.assertFalse(g._explicacion_valida(mala, "Enunciado"))

    def test_se_rechaza_una_explicacion_que_repite_el_enunciado(self):
        enunciado = "Esta es la pregunta tal cual está escrita aquí."
        self.assertFalse(g._explicacion_valida(enunciado, enunciado))


if __name__ == "__main__":
    unittest.main(verbosity=2)
