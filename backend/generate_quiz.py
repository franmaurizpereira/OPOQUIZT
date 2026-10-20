"""Genera las 30 preguntas del quiz a partir de la base de datos vectorial.

Proceso:
  1. Se recuperan fragmentos de la tabla `chunks` y se reparten por PDF para
     cubrir todos los documentos de forma equilibrada.
  2. Un LLM local (Ollama) redacta una pregunta tipo test por cada fragmento.
  3. Se validan las preguntas (formato, idioma y respaldo en el texto) y se
     barajan las opciones para que la correcta no siempre esté en el mismo sitio.
  4. Se vuelca el resultado en `js/quiz.js` con el formato del proyecto.

Uso:
    python backend/generate_quiz.py
"""

import json
import random
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config

# ---------------------------------------------------------------- constantes

TOTAL_PREGUNTAS = 30
LOTE_PREGUNTAS = 3          # preguntas que se piden al LLM en una sola llamada
MAX_INTENTOS = 2            # intentos por lote hasta conseguir preguntas válidas
SEMILLA = 20240517           # semilla para que el barajado sea reproducible
FICHERO_CACHE = config.RAIZ / "logs" / "preguntas_cache.json"  # progreso intermedio

# Palabras vacías del español (para medir el respaldo textual de las preguntas)
VACIAS = {
    "the", "de", "la", "el", "los", "las", "un", "una", "uno", "unos", "unas",
    "y", "o", "u", "en", "a", "al", "del", "por", "para", "con", "sin", "sobre",
    "que", "quien", "cual", "cuanto", "cuando", "donde", "como", "porque",
    "es", "son", "era", "eran", "sea", "se", "su", "sus", "ser", "estar", "est",
    "no", "ni", "más", "mas", "muy", "todo", "toda", "todos", "todas", "otro",
    "otra", "este", "esta", "esto", "ese", "esa", "aquel", "aquella", "si", "sí",
    "entre", "desde", "hasta", "hacia", "cada", "todo", "toda", "esto", "esta",
    "le", "les", "lo", "nos", "os", "me", "te", "se", "ha", "han", "he", "hay",
    "puede", "pueden", "debe", "deben", "deberá", "deberán", "se", "según",
    "cualquier", "mismo", "misma", "tan", "tanto", "así", "solo", "únicamente",
}

# ---------------------------------------------------------------- utilidades


def _limpiar_texto(texto):
    """Normaliza un texto para poder compararlo palabra a palabra."""
    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9áéíóúüñ ]+", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()


def _palabras_significativas(texto):
    """Devuelve el conjunto de palabras con carga semántica de un texto."""
    palabras = _limpiar_texto(texto).split()
    return {p for p in palabras if len(p) > 3 and p not in VACIAS}


def _solapamiento(texto_a, texto_b):
    """Proporción de palabras de A que aparecen en B (0 a 1)."""
    pa = _palabras_significativas(texto_a)
    if not pa:
        return 0.0
    pb = _palabras_significativas(texto_b)
    return len(pa & pb) / len(pa)


def _js_texto(valor):
    """Convierte un valor en una cadena válida de JavaScript."""
    valor = str(valor)
    valor = valor.replace("\\", "\\\\").replace('"', '\\"')
    valor = valor.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    return '"' + valor + '"'


# ------------------------------------------------------------ base de datos


def cargar_fragmentos(conn):
    """Recupera todos los fragmentos de la tabla chunks."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, ruta_pdf, pagina, tipo, contenido FROM chunks ORDER BY ruta_pdf, pagina, id"
        )
        filas = cur.fetchall()
    return [
        {"id": f[0], "ruta_pdf": f[1], "pagina": f[2], "tipo": f[3], "contenido": f[4]}
        for f in filas
    ]


def repartir_contextos(fragmentos, total=TOTAL_PREGUNTAS, minimo_por_pdf=2):
    """Reparte los fragmentos de forma que todos los PDF queden representados.

    La distribución es proporcional al número de fragmentos de cada PDF, con un
    mínimo por documento, y dentro de cada PDF se eligen fragmentos repartidos
    a lo largo de todo el documento.
    """
    por_pdf = {}
    for frag in fragmentos:
        por_pdf.setdefault(frag["ruta_pdf"], []).append(frag)

    pdfs = sorted(por_pdf)
    pesos = {pdf: len(por_pdf[pdf]) for pdf in pdfs}
    suma = sum(pesos.values()) or 1

    # Reparto inicial proporcional
    reparto = {pdf: max(minimo_por_pdf, round(total * pesos[pdf] / suma)) for pdf in pdfs}

    # Ajuste hasta llegar exactamente a `total` preguntas
    while sum(reparto.values()) > total:
        pdf = max(reparto, key=lambda p: reparto[p])
        if reparto[pdf] <= minimo_por_pdf:
            # No se puede bajar más: se reparte el ajuste entre los demás
            candidatos = [p for p in reparto if reparto[p] > minimo_por_pdf]
            if not candidatos:
                break
            reparto[max(candidatos, key=lambda p: reparto[p])] -= 1
        else:
            reparto[pdf] -= 1

    while sum(reparto.values()) < total:
        pdf = max(reparto, key=lambda p: reparto[p])
        reparto[pdf] += 1

    contextos = []
    for pdf in pdfs:
        disponibles = [f for f in por_pdf[pdf] if len(f["contenido"]) >= 250]
        if not disponibles:
            disponibles = por_pdf[pdf]
        cuantos = min(reparto[pdf], len(disponibles))
        if cuantos <= 0:
            continue
        # Se eluyen los fragmentos para cubrir todo el documento
        paso = len(disponibles) / float(cuantos)
        elegidos = []
        for i in range(cuantos):
            indice = int(i * paso + paso / 2)
            indice = max(0, min(indice, len(disponibles) - 1))
            elegidos.append(disponibles[indice])
        contextos.extend(elegidos)

    return contextos


# ------------------------------------------------------------------- LLM


ESQUEMA_PREGUNTAS = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "contexto": {"type": "integer"},
            "pregunta": {"type": "string"},
            "opciones": {"type": "array", "items": {"type": "string"}},
            "correcta": {"type": "integer"},
            "explicacion": {"type": "string"},
        },
        "required": ["contexto", "pregunta", "opciones", "correcta", "explicacion"],
    },
}


def _llamar_llm(prompt, modelo=config.MODELO_LLM, formato="json"):
    """Llama al LLM local de Ollama y devuelve el texto de la respuesta."""
    cuerpo = json.dumps(
        {
            "model": modelo,
            "stream": False,
            "format": formato,
            "messages": [{"role": "user", "content": prompt}],
            "options": {"temperature": 0.35, "num_ctx": 8192, "top_p": 0.9},
        }
    ).encode("utf-8")

    peticion = urllib.request.Request(
        f"{config.URL_OLLAMA}/api/chat",
        data=cuerpo,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(peticion, timeout=1800) as respuesta:
        datos = json.loads(respuesta.read().decode("utf-8"))
    return datos["message"]["content"]


def construir_prompt(contextos):
    """Construye el prompt para un lote de contextos."""
    bloques = []
    for i, ctx in enumerate(contextos, start=1):
        bloques.append(
            f"--- CONTEXTO {i} (documento: {ctx['ruta_pdf'].split('/')[-1]}, "
            f"página {ctx['pagina']}) ---\n{ctx['contenido'][:2200]}"
        )
    texto_contextos = "\n\n".join(bloques)

    return f"""Eres un experto en derecho administrativo y constitucional español
y en la preparación de oposiciones de la Administración Pública.

A partir de los CONTEXTOS siguientes, redacta {len(contextos)} preguntas tipo
test de opción múltiple, UNA por cada contexto.

{texto_contextos}

REGLAS ESTRICTAS:
- Cada pregunta debe responder EXCLUSIVAMENTE al contexto que tiene delante.
- La respuesta correcta debe ser un dato que aparece en el texto: nunca inventes.
- Exactamente 4 opciones por pregunta y solo UNA correcta.
- Las 3 opciones incorrectas deben ser plausibles, del mismo estilo y longitud
  similar a la correcta, pero contradicen el texto.
- La explicación debe indicar por qué la respuesta correcta es la correcta,
  basándose en el dato concreto del texto.
- Escribe todo en español, con lenguaje claro y sin errores ortográficos.
- No uses expresiones como "según el texto" en el enunciado.

Responde SOLO con un array JSON con esta estructura, sin texto adicional:
[
  {{
    "contexto": 1,
    "pregunta": "Enunciado de la pregunta",
    "opciones": ["primera opción", "segunda opción", "tercera opción", "cuarta opción"],
    "correcta": 0,
    "explicacion": "Por qué esa respuesta es la correcta."
  }}
]
"correcta" es el índice (empezando por 0) de la opción correcta."""


def _extraer_json(texto):
    """Extrae el JSON de la respuesta del LLM aunque venga con texto alrededor."""
    texto = texto.strip()
    if texto.startswith("```"):
        texto = re.sub(r"^```[a-zA-Z]*\n?", "", texto)
        texto = re.sub(r"\n?```$", "", texto)

    # Primero se intenta el texto completo
    try:
        datos = json.loads(texto)
        if isinstance(datos, list):
            return datos
        if isinstance(datos, dict):
            return [datos]
    except json.JSONDecodeError:
        pass

    # Si no, se busca el primer array o objeto completo
    decodificador = json.JSONDecoder()
    for posicion, caracter in enumerate(texto):
        if caracter not in "[{":
            continue
        try:
            datos, _ = decodificador.raw_decode(texto[posicion:])
        except json.JSONDecodeError:
            continue
        if isinstance(datos, list):
            return datos
        if isinstance(datos, dict):
            return [datos]
    return None


def guardar_cache(preguntas):
    """Guarda el progreso intermedio para poder retomar la generación.

    Se fusiona con lo que ya había en la caché: si no, una ejecución
    interrumpida perdería las preguntas ya generadas.
    """
    merged = deduplicar(cargar_cache() + list(preguntas))
    FICHERO_CACHE.parent.mkdir(parents=True, exist_ok=True)
    FICHERO_CACHE.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def cargar_cache():
    """Recupera las preguntas generadas en una ejecución anterior."""
    if not FICHERO_CACHE.exists():
        return []
    try:
        return json.loads(FICHERO_CACHE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def generar_preguntas(contextos, modelo=config.MODELO_LLM, objetivo=TOTAL_PREGUNTAS):
    """Pide al LLM las preguntas por lotes y devuelve las válidas.

    Se avanza lote a lote; cada lote se intenta hasta dos veces. El proceso
    se detiene en cuanto se han obtenido `objetivo` preguntas válidas.
    """
    preguntas = []
    lotes = [
        contextos[i : i + LOTE_PREGUNTAS] for i in range(0, len(contextos), LOTE_PREGUNTAS)
    ]

    for numero, lote in enumerate(lotes, start=1):
        if len(preguntas) >= objetivo:
            break
        obturadas = 0
        for intento in range(MAX_INTENTOS):
            print(f"  Lote {numero} (intento {intento + 1}): {len(lote)} fragmentos", flush=True)
            try:
                respuesta = _llamar_llm(
                    construir_prompt(lote), modelo=modelo, formato=ESQUEMA_PREGUNTAS
                )
            except Exception as exc:  # noqa: BLE001 - se informa y se reintenta
                print(f"    error del LLM: {exc}", flush=True)
                continue

            datos = _extraer_json(respuesta)
            if not isinstance(datos, list):
                print("    respuesta no interpretable, se reintenta", flush=True)
                continue

            validas = []
            for posicion, item in enumerate(datos):
                if not isinstance(item, dict):
                    continue
                indice = item.get("contexto", posicion + 1)
                if not isinstance(indice, int) or indice < 1 or indice > len(lote):
                    # Si el índice no es válido se supone el orden del array
                    indice = posicion + 1
                contexto = lote[indice - 1]
                pregunta = validar_pregunta(item, contexto)
                if pregunta:
                    validas.append(pregunta)
                else:
                    print("    pregunta descartada por no superar la validación", flush=True)

            preguntas.extend(validas)
            obturadas += len(validas)
            if obturadas >= len(lote):
                break

        # Se guarda el progreso por si hay que reanudar más tarde
        guardar_cache(preguntas)

    return preguntas[:objetivo]


# ------------------------------------------------------------- validación


def validar_pregunta(item, contexto):
    """Comprueba que una pregunta cumple el formato y está respaldada.

    Devuelve la pregunta normalizada o None si no es válida.
    """
    enunciado = (item.get("pregunta") or "").strip()
    opciones = item.get("opciones") or []
    correcta = item.get("correcta")
    explicacion = (item.get("explicacion") or "").strip()

    # --- formato ---
    if not enunciado or len(enunciado) < 15:
        return None
    if not isinstance(opciones, list) or len(opciones) != 4:
        return None
    opciones = [str(o).strip() for o in opciones]
    if any(len(o) < 1 for o in opciones):
        return None
    if len(set(o.lower() for o in opciones)) != 4:
        return None
    if not isinstance(correcta, int) or correcta < 0 or correcta > 3:
        return None
    if len(explicacion) < 30:
        return None

    # --- idioma: se descartan las preguntas con demasiadas palabras inglesas ---
    inglesas = {"the", "and", "of", "to", "in", "is", "are", "with", "for", "that"}
    palabras = set(_limpiar_texto(enunciado).split())
    if len(palabras & inglesas) >= 2:
        return None

    # --- respaldo en el texto de origen ---
    texto = contexto["contenido"]
    if _solapamiento(enunciado, texto) < 0.30:
        return None
    if _solapamiento(opciones[correcta], texto) < 0.45:
        return None

    # --- coherencia de longitud entre opciones ---
    longitudes = sorted(len(o) for o in opciones)
    mediana = longitudes[1] + longitudes[2]
    if longitudes[3] > mediana * 2.2 or longitudes[0] < mediana * 0.25:
        return None

    return {
        "pregunta": enunciado,
        "opciones": opciones,
        "correcta": correcta,
        "explicacion": explicacion,
        "contexto_id": contexto["id"],
        "fuente": f"{contexto['ruta_pdf'].split('/')[-1]} (pág. {contexto['pagina']})",
    }


def _similitud_opciones(opciones_a, opciones_b):
    """Proporción de opciones de A que aparecen (como texto) en B (0 a 1)."""
    def textos(opciones):
        return {_limpiar_texto(o) for o in opciones if _limpiar_texto(o)}

    ta = textos(opciones_a)
    tb = textos(opciones_b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta)


def _mismo_texto_correcto(pregunta_a, pregunta_b):
    """Indica si dos preguntas tienen exactamente el mismo texto correcto."""
    correcta_a = pregunta_a["opciones"][pregunta_a["correcta"]]
    correcta_b = pregunta_b["opciones"][pregunta_b["correcta"]]
    return _limpiar_texto(correcta_a) == _limpiar_texto(correcta_b)


def _son_duplicadas(pregunta_a, pregunta_b, umbral=0.5):
    """Decide si dos preguntas son en realidad la misma.

    Tres señales: el mismo conjunto de opciones, enunciados casi iguales o
    la misma respuesta correcta con enunciados parecidos (el caso más
    traicionero: el jugador ve la misma solución dos veces).
    """
    if _similitud_opciones(pregunta_a["opciones"], pregunta_b["opciones"]) >= umbral:
        return True

    if _similitud_enunciados(pregunta_a["pregunta"], pregunta_b["pregunta"]) >= 0.6:
        return True

    if (
        _mismo_texto_correcto(pregunta_a, pregunta_b)
        and _similitud_enunciados(pregunta_a["pregunta"], pregunta_b["pregunta"]) >= 0.3
    ):
        return True

    return False


def _similitud_enunciados(enunciado_a, enunciado_b):
    """Similitud de Jaccard entre dos enunciados."""
    pa = _palabras_significativas(enunciado_a)
    pb = _palabras_significativas(enunciado_b)
    if not pa or not pb:
        return 0.0
    return len(pa & pb) / len(pa | pb)


def deduplicar(preguntas, umbral=0.6):
    """Elimina preguntas demasiado parecidas entre sí.

    Se comparan el enunciado, el conjunto de opciones y el texto de la
    respuesta correcta: una pregunta redactada de otra forma pero con las
    mismas opciones es, para el jugador, la misma pregunta.
    """
    unicas = []
    for pregunta in preguntas:
        repetida = False
        for otra in unicas:
            if _son_duplicadas(pregunta, otra, umbral=0.5):
                repetida = True
                break
        if not repetida:
            unicas.append(pregunta)
    return unicas


def barajar_opciones(preguntas, semilla=SEMILLA):
    """Baraja las opciones de cada pregunta y recalcula el índice correcto."""
    generador = random.Random(semilla)
    for pregunta in preguntas:
        correcto = pregunta["opciones"][pregunta["correcta"]]
        generador.shuffle(pregunta["opciones"])
        pregunta["correcta"] = pregunta["opciones"].index(correcto)
    return preguntas


# ------------------------------------------------------------- volcado JS


def escribir_quiz_js(preguntas, ruta=config.RUTA_QUIZ_JS):
    """Escribe el fichero js/quiz.js con el formato del proyecto."""
    ruta.parent.mkdir(parents=True, exist_ok=True)
    lineas = [
        "// =============================================================",
        "// Datos del quiz (30 preguntas).",
        "// Generado automáticamente por backend/generate_quiz.py",
        "// a partir de los PDF ingestados en la base de datos vectorial.",
        "// =============================================================",
        "",
        "const quizData = [",
    ]

    for pregunta in preguntas:
        letras = ["A", "B", "C", "D"]
        opciones = ", ".join(
            _js_texto(f"{letras[i]}) {opcion}")
            for i, opcion in enumerate(pregunta["opciones"])
        )
        lineas.append("    {")
        lineas.append(f"        pregunta: {_js_texto(pregunta['pregunta'])},")
        lineas.append(f"        opciones: [ {opciones} ],")
        lineas.append(f"        correcta: {pregunta['correcta']},")
        lineas.append(f"        explicacion: {_js_texto(pregunta['explicacion'])}")
        lineas.append("    },")

    lineas.append("];")
    lineas.append("")
    ruta.write_text("\n".join(lineas), encoding="utf-8")


# ------------------------------------------------------------------ main


def main():
    inicio = time.time()
    conn = config.conexion()
    try:
        fragmentos = cargar_fragmentos(conn)
    finally:
        conn.close()

    if not fragmentos:
        print("La base de datos está vacía. Ejecuta antes: python backend/ingest.py")
        return

    print(f"Fragmentos en la base de datos: {len(fragmentos)}")
    contextos = repartir_contextos(fragmentos, total=int(TOTAL_PREGUNTAS * 1.8))
    print(f"Contextos seleccionados: {len(contextos)}")

    # Se recupera el progreso de una ejecución anterior, si la hay
    preguntas_cache = cargar_cache()
    if preguntas_cache:
        print(f"Preguntas recuperadas de la caché: {len(preguntas_cache)}")
        ya_usados = {p["contexto_id"] for p in preguntas_cache}
        contextos = [c for c in contextos if c["id"] not in ya_usados]

    # Solo hay que generar las preguntas que faltan: las de la caché ya cuentan
    faltan_por_generar = max(0, TOTAL_PREGUNTAS - len(preguntas_cache))
    preguntas = generar_preguntas(contextos, objetivo=faltan_por_generar)
    preguntas = deduplicar(preguntas_cache + preguntas)
    print(f"Preguntas válidas: {len(preguntas)}")

    # Si faltan preguntas se completan con fragmentos adicionales
    if len(preguntas) < TOTAL_PREGUNTAS:
        print("Faltan preguntas, se completa con fragmentos adicionales...")
        usados = {p["contexto_id"] for p in preguntas}
        extras = [c for c in fragmentos if c["id"] not in usados and len(c["contenido"]) >= 400]
        aleatorio = random.Random(SEMILLA)
        aleatorio.shuffle(extras)
        faltan = TOTAL_PREGUNTAS - len(preguntas)
        supplementing = generar_preguntas(extras[: faltan * 4], objetivo=faltan)
        preguntas = deduplicar(preguntas + supplementing)
        preguntas = preguntas[:TOTAL_PREGUNTAS]

    preguntas = preguntas[:TOTAL_PREGUNTAS]
    barajar_opciones(preguntas)
    escribir_quiz_js(preguntas)
    guardar_cache(preguntas)
    print(f"Escrito {config.RUTA_QUIZ_JS} con {len(preguntas)} preguntas")
    print(f"Tiempo total: {round(time.time() - inicio, 1)} s")


if __name__ == "__main__":
    main()
