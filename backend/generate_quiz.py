"""Genera las 30 preguntas del quiz a partir de la base de datos vectorial.

Proceso:
  1. Se recuperan fragmentos de la tabla `chunks` y se reparten por PDF para
     cubrir todos los documentos de forma equilibrada.
  2. Un LLM local (Ollama) redacta una pregunta tipo test por cada fragmento.
  3. Se validan las preguntas (formato, idioma y respaldo en el texto) y se
     barajan las opciones para que la correcta no siempre esté en el mismo sitio.
  4. Se vuelca el resultado en `js/quiz.js` con el formato del proyecto.

Modo pool (--pool N):
  Genera N preguntas y las guarda en `js/quiz_pool.json` para que el frontend
  seleccione 30 aleatorias en cada partida. No toca `js/quiz.js`.

Uso:
    python backend/generate_quiz.py              # modo normal: 30 preguntas -> js/quiz.js
    python backend/generate_quiz.py --pool 1000  # modo pool: 1000 preguntas -> js/quiz_pool.json
"""

import argparse
import json
import os
import random
import re
import sys
import time
import urllib.request
from collections import deque
from concurrent.futures import (
    FIRST_COMPLETED,
    ThreadPoolExecutor,
    as_completed,
    wait,
)
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config

# ---------------------------------------------------------------- constantes

TOTAL_PREGUNTAS = 30
LOTE_PREGUNTAS = 3          # preguntas que se piden al LLM en una sola llamada
MAX_INTENTOS = 2            # intentos por lote hasta conseguir preguntas válidas
MAX_INTENTOS_POOL = 3       # intentos por fragmento en el modo pool
LOTE_PREGUNTAS_POOL = int(os.environ.get("OPOQUIZ_LOTE", "4"))
WORKERS_POOL = int(os.environ.get("OPOQUIZ_WORKERS", "8"))
MAX_INTENTOS_RED = 4         # reintentos cuando la API remota falla o expira
TIEMPO_MAX_LLM = 120         # segundos máximos de espera por respuesta
ESPERA_ENTRE_INTENTOS = 15   # segundos de espera antes de reintentar
SOLAPAMIENTO_MINIMO = 0.20   # parecido mínimo entre enunciado y texto
SOLAPAMIENTO_OPCION = 0.35   # parecido mínimo entre la opción correcta y el texto
PENSAMIENTO = False         # desactivar el razonamiento del modelo: multiplica la velocidad
CONTEXTO_POOL = 8192        # ventana de contexto para las llamadas del pool
MAX_TOKENS_RESPUESTA = int(os.environ.get("OPOQUIZ_MAX_TOKENS", "4096"))
SEMILLA = 20240517           # semilla para que el barajado sea reproducible
FICHERO_CACHE = config.RAIZ / "logs" / "preguntas_cache.json"  # progreso intermedio
CHECKPOINT_CADA = 25        # guarda el pool cada N preguntas generadas
SEMILLA_OPCIONES = 1        # semilla al barajar las opciones del pool publicado

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


PATRON_PREFIJO_OPCION = re.compile(r"^\s*[a-dA-D][)\-.\:]\s*")


def _sin_prefijo_opcion(texto):
    """Quita los prefijos «A)», «b.»… que algunos modelos meten en la opción.

    El juego numera las opciones al pintarlas, así que si el texto llega con
    su propia letra se vería «A) A) …». Se quitan todas las capas.
    """
    limpio = str(texto).strip()
    while True:
        nuevo = PATRON_PREFIJO_OPCION.sub("", limpio, count=1).strip()
        if nuevo == limpio:
            return limpio
        limpio = nuevo


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


def seleccionar_chunks_para_pool(
    fragmentos,
    num_preguntas,
    maximo_por_pdf=None,
    minimo_por_pdf=1,
):
    """Selecciona fragmentos para el pool, priorizando cubrir todo el texto.

    El reparto no es una ronda igual para cada PDF: cada documento aporta en
    proporción al texto que contiene, de modo que los documentos largos
    (TREBEP, Gobierno) no se queden a la mitad mientras los cortos van
    sobrados. Dentro de cada documento se toman primero los fragmentos más
    largos, pero empezando por uno de cada página: así se cubre el documento
    entero y no solo sus primeras páginas.

    Con `maximo_por_pdf` (0-1) se puede imponer además un tope de
    concentración; por defecto no hay tope porque el reparto proporcional ya
    evita que un documento acapare el pool.

    La selección es determinista: con los mismos fragmentos devuelve siempre
    la misma lista.
    """
    por_pdf = {}
    for frag in fragmentos:
        por_pdf.setdefault(frag["ruta_pdf"], []).append(frag)

    if not por_pdf:
        return []

    # Cada PDF aporta sus fragmentos con contenido suficiente; si no hay
    # ninguno, se usan todos para no quedarse sin material
    ordenados = {}
    for pdf, lista in por_pdf.items():
        candidatos = [f for f in lista if len(f["contenido"]) >= 250] or lista
        ordenados[pdf] = candidatos

    # Reparto proporcional al texto de cada documento
    texto_por_pdf = {
        pdf: sum(len(f["contenido"]) for f in lista)
        for pdf, lista in ordenados.items()
    }
    texto_total = sum(texto_por_pdf.values()) or 1

    cuotas = {}
    for pdf, lista in ordenados.items():
        cuota = round(num_preguntas * texto_por_pdf[pdf] / texto_total)
        cuota = max(minimo_por_pdf, cuota)
        if maximo_por_pdf:
            tope = max(minimo_por_pdf, int(num_preguntas * maximo_por_pdf))
            cuota = min(cuota, tope)
        cuotas[pdf] = min(cuota, len(lista))

    # Si al recortar a lo disponible faltan preguntas, se reparten entre los
    # documentos que aún tienen fragmentos de sobra
    while sum(cuotas.values()) < num_preguntas:
        huecos = {pdf: len(ordenados[pdf]) - cuotas[pdf] for pdf in ordenados}
        pdf = max(huecos, key=lambda p: (huecos[p], texto_por_pdf[p]))
        if huecos[pdf] <= 0:
            break
        cuotas[pdf] += 1

    # Y si los redondeos se han pasado, se quita del documento que más
    # aporta: así el recorte final no deja fuera siempre al último PDF
    while sum(cuotas.values()) > num_preguntas:
        pdf = max(cuotas, key=lambda p: (cuotas[p], texto_por_pdf[p]))
        if cuotas[pdf] <= minimo_por_pdf:
            break
        cuotas[pdf] -= 1

    elegidos = []
    for pdf in sorted(ordenados):
        elegidos.extend(_elegir_de_documento(ordenados[pdf], cuotas[pdf]))

    return elegidos[:num_preguntas]


def _elegir_de_documento(fragmentos, cuota):
    """Toma `cuota` fragmentos de un documento, cubriéndolo página a página.

    Primero se elige el fragmento más largo de cada página (así ninguna zona
    del documento se queda fuera) y después se completa con los más largos
    que queden.
    """
    if cuota <= 0:
        return []

    por_pagina = {}
    for frag in fragmentos:
        actual = por_pagina.get(frag["pagina"])
        if actual is None or len(frag["contenido"]) > len(actual["contenido"]):
            por_pagina[frag["pagina"]] = frag

    elegidos = [por_pagina[pagina] for pagina in sorted(por_pagina)]
    if len(elegidos) >= cuota:
        return elegidos[:cuota]

    usados = {frag["id"] for frag in elegidos}
    resto = sorted(
        (f for f in fragmentos if f["id"] not in usados),
        key=lambda f: (-len(f["contenido"]), f["id"]),
    )
    for frag in resto:
        if len(elegidos) >= cuota:
            break
        elegidos.append(frag)
    return elegidos[:cuota]


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


def _llamar_openrouter(prompt, esquema=None):
    """Llama a un modelo de OpenRouter y devuelve el texto de la respuesta.

    Se usa para generar el pool de preguntas: es mucho más rápido que el
    modelo local de Ollama.

    La respuesta se pide en streaming (SSE). Con la respuesta completa en un
    solo bloque, si el proveedor deja de enviar datos a mitad de la
    respuesta la conexión se queda abierta indefinidamente y el proceso
    parece colgado; con el streaming, cada fragmento que llega reinicia el
    tiempo de espera y el final de la respuesta es explícito.

    Los modelos `:free` tienen un cupo limitado: cuando se supera, la
    petición se queda en cola en vez de fallar. Por eso se pone un tiempo
    máximo de espera y, si la llamada falla, se reintenta con una espera
    creciente entre intentos.
    """
    cuerpo = {
        "model": config.MODELO_LLM_OPENROUTER,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.35,
        "top_p": 0.9,
        "stream": True,
        # Sin max_tokens, OpenRouter reserva el máximo del modelo (131.072
        # tokens) y rechaza la petición con 402 aunque haya saldo. Con un
        # lote de 4 preguntas, 4.096 tokens sobran.
        "max_tokens": MAX_TOKENS_RESPUESTA,
    }

    # Se pide la respuesta en JSON con el esquema de las preguntas
    if esquema:
        cuerpo["response_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": "preguntas",
                "strict": True,
                "schema": esquema,
            },
        }

    datos_peticion = json.dumps(cuerpo).encode("utf-8")
    ultimo_error = None

    for intento in range(MAX_INTENTOS_RED):
        peticion = urllib.request.Request(
            config.URL_OPENROUTER,
            data=datos_peticion,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {config.OPENROUTER_API_KEY}",
                "HTTP-Referer": "https://github.com/opoquiz",
                "X-Title": config.OPENROUTER_TITULO,
                "Accept": "text/event-stream",
            },
        )
        try:
            partes = []
            inicio = time.time()
            with urllib.request.urlopen(peticion, timeout=TIEMPO_MAX_LLM) as respuesta:
                for linea in respuesta:
                    # El proveedor puede mandar comentarios de mantenimiento
                    # (pings) que reinician el tiempo de espera del socket:
                    # se comprueba el tiempo total para no esperar infinito
                    if time.time() - inicio > TIEMPO_MAX_LLM:
                        raise TimeoutError("el modelo ha tardado demasiado")
                    texto = linea.decode("utf-8").strip()
                    if not texto.startswith("data:"):
                        continue
                    datos = texto[5:].strip()
                    if datos == "[DONE]":
                        break
                    try:
                        evento = json.loads(datos)
                    except json.JSONDecodeError:
                        continue
                    for eleccion in evento.get("choices", []):
                        trozo = (eleccion.get("delta") or {}).get("content")
                        if trozo:
                            partes.append(trozo)

            if not partes:
                raise RuntimeError("el modelo no ha devuelto contenido")
            return "".join(partes)
        except Exception as exc:  # noqa: BLE001 - se reintenta
            ultimo_error = exc
            if intento + 1 < MAX_INTENTOS_RED:
                espera = ESPERA_ENTRE_INTENTOS * (intento + 1)
                print(
                    f"  OpenRouter: {exc}. Se reintenta en {espera} s",
                    flush=True,
                )
                time.sleep(espera)

    raise RuntimeError(f"OpenRouter no ha podido responder: {ultimo_error}")


def _llamar_llm(prompt, modelo=config.MODELO_LLM, formato="json", num_ctx=8192):
    """Llama al LLM y devuelve el texto de la respuesta.

    Si hay clave de OpenRouter configurada se usa el modelo remoto (más
    rápido); si no, se usa el modelo local de Ollama.
    """
    if config.OPENROUTER_API_KEY:
        esquema = formato if isinstance(formato, dict) else None
        return _llamar_openrouter(prompt, esquema)

    cuerpo = json.dumps(
        {
            "model": modelo,
            "stream": False,
            "format": formato,
            "messages": [{"role": "user", "content": prompt}],
            "options": {
                "temperature": 0.35,
                "num_ctx": num_ctx,
                "top_p": 0.9,
                # Sin razonamiento: la pregunta no lo necesita y el modelo
                # tarda mucho menos (de ~70 s a ~25 s por lote).
                "think": PENSAMIENTO,
            },
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
- El enunciado debe mencionar términos concretos que aparecen literalmente en
  el texto (por ejemplo, el nombre de una ley, de un artículo o de un
  concepto técnico). No lo redactes de forma genérica.
- La opción correcta debe copiar el dato del texto casi literalmente, cambiando
  solo lo justo para que sea una frase completa.

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


def guardar_cache(preguntas, ruta=FICHERO_CACHE):
    """Guarda el progreso intermedio para poder retomar la generación.

    Se fusiona con lo que ya había en la caché: si no, una ejecución
    interrumpida perdería las preguntas ya generadas.
    """
    merged = deduplicar(cargar_cache(ruta) + list(preguntas))
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def cargar_cache(ruta=FICHERO_CACHE):
    """Recupera las preguntas generadas en una ejecución anterior."""
    if not ruta.exists():
        return []
    try:
        return json.loads(ruta.read_text(encoding="utf-8"))
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


def _generar_lote(lote, modelo, numero):
    """Genera las preguntas de un lote de fragmentos.

    Devuelve la lista de preguntas válidas de ese lote. Si la llamada al
    modelo falla, se reintenta hasta `MAX_INTENTOS` veces.
    """
    for intento in range(MAX_INTENTOS):
        try:
            respuesta = _llamar_llm(
                construir_prompt(lote),
                modelo=modelo,
                formato=ESQUEMA_PREGUNTAS,
                num_ctx=CONTEXTO_POOL,
            )
        except Exception as exc:  # noqa: BLE001 - se informa y se reintenta
            print(
                f"  Lote {numero}: error del LLM ({exc}), se reintenta",
                flush=True,
            )
            continue

        datos = _extraer_json(respuesta)
        if not isinstance(datos, list):
            print(
                f"  Lote {numero}: respuesta no interpretable, se reintenta",
                flush=True,
            )
            continue

        validas = []
        for posicion, item in enumerate(datos):
            if not isinstance(item, dict):
                continue
            indice = item.get("contexto", posicion + 1)
            if not isinstance(indice, int):
                indice = posicion + 1
            if indice < 1 or indice > len(lote):
                indice = posicion + 1
            contexto = lote[indice - 1]
            pregunta = validar_pregunta(item, contexto)
            if pregunta:
                validas.append(pregunta)
            else:
                razon = validar_pregunta(item, contexto, con_motivo=True)
                print(
                    f"  Lote {numero}: pregunta descartada ({razon})",
                    flush=True,
                )

        return validas

    return []


def generar_preguntas_pool(
    contextos,
    modelo=config.MODELO_LLM,
    objetivo=TOTAL_PREGUNTAS,
    ruta_cache=None,
    pool_previo=None,
    tamanho_lote=LOTE_PREGUNTAS_POOL,
    workers=WORKERS_POOL,
):
    """Genera las preguntas del pool por lotes.

    Pedir tres preguntas en una sola llamada al modelo es mucho más rápido
    que pedirlas de una en una: el tiempo de respuesta del modelo se paga
    una vez, no tres. La validación y la deduplicación son las mismas que en
    el resto del generador, así que la calidad no baja.

    Cuando hay un modelo remoto (OpenRouter) los lotes se piden en paralelo:
    la espera es de red, así que se hacen varias llamadas a la vez. Con el
    modelo local de Ollama, en cambio, la CPU es el recurso escaso y se pide
    de un lote en uno.

    El progreso se guarda en `ruta_cache` cada `CHECKPOINT_CADA` preguntas,
    de modo que la ejecución se puede cortar y reanudar.
    """
    pool = list(pool_previo) if pool_previo else []
    if ruta_cache is None:
        ruta_cache = config.RUTA_CACHE_POOL
    ya_en_pool = {p.get("contexto_id") for p in pool}
    objetivos = [c for c in contextos if c["id"] not in ya_en_pool]
    lotes = [
        objetivos[i : i + tamanho_lote] for i in range(0, len(objetivos), tamanho_lote)
    ]

    if not config.OPENROUTER_API_KEY:
        workers = 1
    else:
        workers = max(1, workers)

    generadas = 0
    guardadas = len(pool)

    # Los lotes se piden en ventana deslizante: siempre hay `workers`
    # peticiones en vuelo y, en cuanto una termina, se procesa y se lanza la
    # siguiente. Antes se esperaba a la tanda entera y un lote lento (o un
    # reintento) bloqueaba a los demás.
    pendientes = deque(lotes)
    en_curso = {}
    lanzados = 0
    procesados = 0

    with ThreadPoolExecutor(max_workers=workers) as ejecutor:
        while (pendientes or en_curso) and len(pool) < objetivo:
            while pendientes and len(en_curso) < workers:
                lote = pendientes.popleft()
                lanzados += 1
                futuro = ejecutor.submit(_generar_lote, lote, modelo, lanzados)
                en_curso[futuro] = lanzados

            if not en_curso:
                break

            hechos, _ = wait(en_curso, return_when=FIRST_COMPLETED)

            for futuro in hechos:
                numero = en_curso.pop(futuro)
                try:
                    validas = futuro.result()
                except Exception as exc:  # noqa: BLE001 - un lote no corta el pool
                    print(f"  Lote {numero}: se descarta ({exc})", flush=True)
                    validas = []

                nuevas = []
                for pregunta in validas:
                    if _son_duplicadas_con_pool(pregunta, pool + nuevas):
                        print("    pregunta descartada por estar repetida", flush=True)
                        continue
                    nuevas.append(pregunta)

                pool.extend(nuevas)
                generadas += len(nuevas)
                procesados += 1

                print(
                    f"  [lote {procesados}/{len(lotes)}] {len(pool)}/{objetivo} preguntas",
                    flush=True,
                )

                # Guardado periódico: si se corta la ejecución, no se pierde
                # el trabajo. Además se publica el pool a medias, para que se
                # pueda jugar mientras la generación sigue.
                if len(pool) - guardadas >= CHECKPOINT_CADA:
                    guardar_cache(pool, ruta_cache)
                    guardadas = len(pool)
                    publicar(pool, ruta_cache)
                    print(
                        f"  [checkpoint] {len(pool)} preguntas guardadas en la caché",
                        flush=True,
                    )

    return pool[:objetivo]


def recortar_equilibrado(pool, cantidad, minimo_por_tema=50):
    """Recorta el pool a `cantidad` sin dejar ningún tema bajo el mínimo.

    Un `pool[:cantidad]` recortaría siempre a los mismos temas (los últimos
    de la generación). Aquí se reparte la cantidad de forma proporcional a
    lo generado y se respeta un suelo por tema, para que ningún temario se
    quede fuera del pool al recortar.
    """
    if len(pool) <= cantidad:
        return list(pool)

    def tema(pregunta):
        return pregunta.get("tema") or config.tema_de_fuente(pregunta.get("fuente"))

    por_tema = {}
    for pregunta in pool:
        por_tema.setdefault(tema(pregunta), []).append(pregunta)

    if len(por_tema) * minimo_por_tema > cantidad:
        minimo_por_tema = max(1, cantidad // max(1, len(por_tema)))

    total = sum(len(preguntas) for preguntas in por_tema.values()) or 1
    sobrante = cantidad - minimo_por_tema * len(por_tema)
    cuotas = {
        nombre: minimo_por_tema + round(sobrante * len(preguntas) / total)
        for nombre, preguntas in por_tema.items()
    }

    elegidas = []
    for nombre, preguntas in por_tema.items():
        elegidas.extend(preguntas[: cuotas[nombre]])

    # Ajuste fino por redondeos: se quitan o se añaden preguntas
    while len(elegidas) > cantidad:
        nombre = max(
            por_tema,
            key=lambda n: sum(1 for p in elegidas if tema(p) == n),
        )
        for indice in range(len(elegidas) - 1, -1, -1):
            if tema(elegidas[indice]) == nombre:
                elegidas.pop(indice)
                break

    if len(elegidas) < cantidad:
        ya = {id(p) for p in elegidas}
        for pregunta in pool:
            if len(elegidas) >= cantidad:
                break
            if id(pregunta) not in ya:
                elegidas.append(pregunta)

    return elegidas[:cantidad]


def publicar(pool, ruta_cache=None):
    """Publica el pool en `js/quiz_pool.json` aunque esté a medias.

    Así se puede jugar con las preguntas ya generadas mientras la generación
    sigue en marcha. Si el pool tiene menos preguntas de las necesarias, el
    frontend lo descarta y usa `js/quiz.js`.
    """
    if not pool:
        return
    escribir_pool_json(pool)


# ------------------------------------------------------------- validación


def generar_pregunta_desde_chunk(
    chunk, modelo=config.MODELO_LLM, intentos=MAX_INTENTOS_POOL
):
    """Genera UNA pregunta a partir de un fragmento concreto.

    A diferencia de `generar_preguntas`, que pide lotes de tres, aquí se va
    fragmento a fragmento: así el pool avanza de uno en uno, se puede
    guardar el progreso en cualquier momento y ninguna pregunta se genera
    dos veces aunque se reanude la ejecución.

    Devuelve la pregunta validada o None si no se ha conseguido ninguna.
    """
    for intento in range(intentos):
        print(
            f"  Fragmento {chunk['id']} (intento {intento + 1}/{intentos})",
            flush=True,
        )
        try:
            respuesta = _llamar_llm(
                construir_prompt([chunk]), modelo=modelo, formato=ESQUEMA_PREGUNTAS
            )
        except Exception as exc:  # noqa: BLE001 - se informa y se reintenta
            print(f"    error del LLM: {exc}", flush=True)
            continue

        datos = _extraer_json(respuesta)
        if not isinstance(datos, list) or not datos:
            print("    respuesta no interpretable, se reintenta", flush=True)
            continue

        item = datos[0]
        if not isinstance(item, dict):
            continue

        pregunta = validar_pregunta(item, chunk)
        if pregunta:
            return pregunta
        print("    pregunta descartada por no superar la validación", flush=True)

    return None


def deduplicar_pool(preguntas, umbral=0.5):
    """Elimina del pool las preguntas duplicadas o demasiado parecidas.

    Se comparan el enunciado y el conjunto de opciones: para el jugador, dos
    preguntas con las mismas opciones son la misma pregunta aunque estén
    redactadas de forma distinta.
    """
    return deduplicar(preguntas, umbral=umbral)


def validar_pregunta(item, contexto, con_motivo=False):
    """Comprueba que una pregunta cumple el formato y está respaldada.

    Devuelve la pregunta normalizada o None si no es válida. Si se pide
    `con_motivo`, devuelve en su lugar el motivo del descarte.
    """
    enunciado = (item.get("pregunta") or "").strip()
    opciones = item.get("opciones") or []
    correcta = item.get("correcta")
    explicacion = (item.get("explicacion") or "").strip()

    def motivo(razon):
        return razon if con_motivo else None

    # --- formato ---
    if not enunciado or len(enunciado) < 15:
        return motivo("enunciado demasiado corto")
    if not isinstance(opciones, list) or len(opciones) != 4:
        return motivo("no tiene exactamente 4 opciones")
    opciones = [_sin_prefijo_opcion(o) for o in opciones]
    if any(len(o) < 1 for o in opciones):
        return motivo("tiene una opción vacía")
    if len(set(o.lower() for o in opciones)) != 4:
        return motivo("tiene opciones repetidas")
    if not isinstance(correcta, int) or correcta < 0 or correcta > 3:
        return motivo("el índice de la correcta no es válido")
    if len(explicacion) < 30:
        return motivo("explicación demasiado corta")

    # --- idioma: se descartan las preguntas con palabras inglesas ---
    inglesas = {
        "the", "and", "of", "to", "in", "is", "are", "was", "were", "with",
        "for", "that", "this", "these", "those", "from", "have", "has",
        "been", "will", "would", "shall", "which", "they", "their", "there",
        "include", "includes", "including", "comprising", "comprises",
        "according", "states", "provides", "upon", "within", "without",
        "between", "among", "into", "through", "during", "before", "after",
        "above", "below", "under", "over", "against", "such", "only", "other",
        "others", "same", "such", "first", "second", "third", "which",
    }
    for texto in (enunciado, explicacion):
        palabras = set(_limpiar_texto(texto).split())
        if len(palabras & inglesas) >= 2:
            return motivo("el texto tiene palabras en inglés")

    # --- respaldo en el texto de origen ---
    texto = contexto["contenido"]
    if _solapamiento(enunciado, texto) < SOLAPAMIENTO_MINIMO:
        return motivo("el enunciado no está respaldado por el texto")
    if _solapamiento(opciones[correcta], texto) < SOLAPAMIENTO_OPCION:
        return motivo("la opción correcta no está respaldada por el texto")

    # --- coherencia de longitud entre opciones ---
    longitudes = sorted(len(o) for o in opciones)
    mediana = longitudes[1] + longitudes[2]
    if longitudes[3] > mediana * 2.2 or longitudes[0] < mediana * 0.25:
        return motivo("las opciones tienen longitudes muy distintas")

    if con_motivo:
        return {
            "pregunta": enunciado,
            "opciones": opciones,
            "correcta": correcta,
            "explicacion": explicacion,
            "contexto_id": contexto["id"],
            "fuente": f"{contexto['ruta_pdf'].split('/')[-1]} (pág. {contexto['pagina']})",
        }

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


def _barajar_opciones(pregunta, azar):
    """Baraja las opciones de una pregunta y recalcula la correcta.

    El modelo tiende a colocar siempre la respuesta correcta en el primer
    lugar. Barajar aquí deja el pool equilibrado y evita que un jugador
    acierte siempre por costumbre.
    """
    opciones = list(pregunta["opciones"])
    indices = list(range(len(opciones)))
    azar.shuffle(indices)

    barajada = dict(pregunta)
    barajada["opciones"] = [opciones[indice] for indice in indices]
    barajada["correcta"] = indices.index(pregunta["correcta"])
    return barajada


def escribir_pool_json(preguntas, ruta=config.QUIZ_POOL_PATH):
    """Escribe el fichero js/quiz_pool.json como array JSON plano.

    Se guarda con el mismo esquema que `quizData` de `js/quiz.js`: solo los
    cuatro campos que el quiz necesita. Los datos de traza (`contexto_id`,
    `fuente`) se quedan en la caché, no en el pool publicado.

    Las opciones se barajan antes de guardar, para que la respuesta correcta
    no esté siempre en el mismo lugar.
    """
    ruta.parent.mkdir(parents=True, exist_ok=True)
    azar = random.Random(SEMILLA_OPCIONES)
    limpio = []
    for p in preguntas:
        barajada = _barajar_opciones(p, azar)
        # Red de seguridad: ninguna opción publicada lleva su propia letra
        barajada["opciones"] = [
            _sin_prefijo_opcion(opcion) for opcion in barajada["opciones"]
        ]
        # El tema viaja con la pregunta para que el navegador pueda repartir
        # la partida por temarios. Si la pregunta ya lo trae se respeta; si
        # no, se deduce de la fuente; y si tampoco hay fuente, "General".
        tema = barajada.get("tema") or config.tema_de_fuente(barajada.get("fuente"))
        limpio.append(
            {
                "pregunta": barajada["pregunta"],
                "opciones": list(barajada["opciones"]),
                "correcta": barajada["correcta"],
                "explicacion": barajada["explicacion"],
                "tema": tema,
            }
        )
    # Escribir atómicamente: temporal + replace
    temporal = ruta.with_suffix(".tmp")
    temporal.write_text(
        json.dumps(limpio, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    temporal.replace(ruta)
    print(f"Escrito {ruta} con {len(limpio)} preguntas")


# ------------------------------------------------------------------ main


def parse_args(argv=None):
    """Interpreta los argumentos de la línea de órdenes."""
    analizador = argparse.ArgumentParser(
        description=(
            "Genera preguntas para el quiz a partir de la base de datos vectorial. "
            "Sin opciones escribe las 30 preguntas en js/quiz.js; "
            "con --pool N escribe N preguntas en js/quiz_pool.json."
        )
    )
    analizador.add_argument(
        "--pool",
        type=int,
        metavar="N",
        default=None,
        help=(
            "Genera N preguntas y las guarda en js/quiz_pool.json "
            "(pool para partidas aleatorias). No modifica js/quiz.js."
        ),
    )
    analizador.add_argument(
        "--mejorar-explicaciones",
        action="store_true",
        help=(
            "Reescribe las explicaciones de js/quiz_pool.json que hablan de "
            "'el texto' o 'el pasaje' para que se entiendan solas. "
            "Necesita OPENROUTER_API_KEY."
        ),
    )
    analizador.add_argument(
        "--desde-cero",
        action="store_true",
        help=(
            "Ignora la caché del pool y regenera todas las preguntas desde "
            "cero (junto con --pool N). La caché anterior se aparta."
        ),
    )
    return analizador.parse_args(argv)


def main(argv=None):
    argumentos = parse_args(argv)
    if argumentos.mejorar_explicaciones:
        return main_mejorar_explicaciones()
    if argumentos.pool is not None:
        return main_pool(argumentos.pool, desde_cero=argumentos.desde_cero)
    return main_normal()


def main_mejorar_explicaciones():
    """Modo `--mejorar-explicaciones`: reescribe las explicaciones del pool.

    Algunas explicaciones dicen "el texto" o "el pasaje" para referirse al
    fragmento del que salieron. En la revisión de la partida esas palabras no
    significan nada para quien la lee, así que se reescriben para que la
    explicación se entienda sola.

    Solo se toca el campo `explicacion`: el enunciado, las opciones y la
    posición de la correcta no se modifican.
    """
    if not config.OPENROUTER_API_KEY:
        print(
            "Falta OPENROUTER_API_KEY: hace falta un modelo remoto para "
            "reescribir las explicaciones."
        )
        return

    inicio = time.time()
    preguntas = json.loads(config.QUIZ_POOL_PATH.read_text(encoding="utf-8"))
    print(f"Preguntas en el pool: {len(preguntas)}")

    pendientes = [p for p in preguntas if _explicacion_necesita_reescritura(p)]
    print(f"Explicaciones que hablan de 'el texto': {len(pendientes)}")

    if not pendientes:
        print("No hay nada que reescribir.")
        return

    # Se guarda el progreso aparte para poder parar y reanudar
    ruta_cache = config.RUTA_CACHE_POOL.parent / "explicaciones_cache.json"
    ya_hechas = _cargar_lista(ruta_cache)
    indices_hechos = {p.get("indice") for p in ya_hechas}

    def reescribir(pregunta):
        return mejorar_explicacion(
            config.MODELO_LLM_OPENROUTER,
            pregunta["pregunta"],
            pregunta["opciones"],
            pregunta.get("correcta", 0),
            pregunta["explicacion"],
        )

    reescritas = reescribir_en_paralelo(
        pendientes, reescribir, ya_hechas, ruta_cache
    )

    # Se aplican las mejoras al pool
    for mejora in ya_hechas:
        indice = mejora.get("indice")
        if isinstance(indice, int) and 0 <= indice < len(pendientes):
            pendientes[indice]["explicacion"] = mejora["explicacion"]

    escribir_pool_json(preguntas)
    print(f"Explicaciones reescritas: {reescritas}")
    print(f"Tiempo total: {time.time() - inicio:.1f} s")


# Expresiones que hacen que una explicación no se entienda sola.
# "el Texto Refundido" es el nombre de una ley y no cuenta.
PATRON_REFERENCIAS = re.compile(
    r"\b(el texto|el pasaje|el contexto|el fragmento)\b"
    r"(?!\s+(refundido|consolidado))",
    re.IGNORECASE,
)


def reescribir_en_paralelo(
    pendientes, reescribir, ya_hechas, ruta_cache, workers=WORKERS_POOL
):
    """Reescribe las explicaciones pendientes con varios hilos a la vez.

    `reescribir(pregunta)` devuelve el texto nuevo o None. El progreso se
    guarda cada 25 explicaciones, así que se puede cortar y reanudar. Los
    resultados se aplican en el hilo principal: la lista compartida no se
    toca desde los hilos.
    """
    indices_hechos = {p.get("indice") for p in ya_hechas}
    faltan = [
        (indice, pregunta)
        for indice, pregunta in enumerate(pendientes)
        if indice not in indices_hechos
    ]
    reescritas = 0

    with ThreadPoolExecutor(max_workers=max(1, workers)) as ejecutor:
        futuros = {
            ejecutor.submit(reescribir, pregunta): indice
            for indice, pregunta in faltan
        }
        for revisadas, futuro in enumerate(as_completed(futuros), start=1):
            indice = futuros[futuro]
            try:
                nueva = futuro.result()
            except Exception:  # noqa: BLE001 - una explicación no puede cortar todo
                nueva = None

            if nueva:
                ya_hechas.append({"indice": indice, "explicacion": nueva})
                reescritas += 1

            if revisadas % 25 == 0:
                _guardar_lista(ya_hechas, ruta_cache)
                print(
                    f"  [checkpoint] {revisadas}/{len(faltan)} "
                    "explicaciones revisadas",
                    flush=True,
                )

    _guardar_lista(ya_hechas, ruta_cache)
    return reescritas


def _cargar_lista(ruta):
    """Carga una lista de JSON de un fichero. Si no existe o está corrupto, vacío."""
    if not ruta.exists():
        return []
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return datos if isinstance(datos, list) else []


def _guardar_lista(elementos, ruta):
    """Guarda una lista de JSON en un fichero, de forma atómica."""
    ruta.parent.mkdir(parents=True, exist_ok=True)
    temporal = ruta.with_suffix(".tmp")
    temporal.write_text(
        json.dumps(elementos, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    temporal.replace(ruta)


def _explicacion_necesita_reescritura(pregunta):
    """Indica si la explicación habla de "el texto" o "el pasaje"."""
    explicacion = str(pregunta.get("explicacion", ""))
    return bool(PATRON_REFERENCIAS.search(explicacion))


def _explicacion_valida(explicacion, enunciado):
    """Comprueba que la explicación reescrita es utilizable.

    Debe estar en español, tener una longitud razonable, no hablar de "el
    texto" y no ser una copia del enunciado.
    """
    if not isinstance(explicacion, str):
        return False

    texto = explicacion.strip()
    if len(texto) < 40 or len(texto) > 600:
        return False

    if _explicacion_necesita_reescritura({"explicacion": texto}):
        return False

    # No debe repetir el enunciado
    if texto.lower() == str(enunciado).strip().lower():
        return False

    return True


def mejorar_explicacion(modelo, enunciado, opciones, correcta, explicacion_actual):
    """Reescribe una explicación para que se entienda sola.

    Devuelve la nueva explicación o None si no se ha podido mejorarla (en ese
    caso se conserva la anterior).
    """
    correcta_texto = ""
    if isinstance(opciones, list) and 0 <= correcta < len(opciones):
        correcta_texto = str(opciones[correcta])

    prompt = f"""Eres un profesor de oposiciones de la Administración Pública.

Esta es la pregunta:
{enunciado}

Y estas son sus cuatro opciones, siendo la correcta:
{correcta_texto}

Esta es la explicación que hay que reescribir:
{explicacion_actual}

Reescribe la explicación con estas reglas:
- Explica por qué la opción "{correcta_texto}" es la correcta.
- NO escribas "el texto", "el pasaje", "el contexto", "el fragmento" ni
  "según el texto": la explicación tiene que entenderse sola, sin ver el
  documento original.
- Menciona el dato concreto (la ley, el artículo o el concepto) que sustenta
  la respuesta.
- Entre 40 y 600 caracteres, en español claro y sin errores.
- No inventes datos que no estén en la explicación original.

Responde SOLO con la explicación reescrita, sin comillas ni texto adicional."""

    try:
        respuesta = _llamar_llm(prompt, modelo=modelo, formato="json")
    except Exception as exc:  # noqa: BLE001 - se informa y se sigue
        print(f"    error del LLM: {exc}", flush=True)
        return None

    explicacion = str(respuesta).strip()
    # Si el modelo devuelve un JSON con la explicación dentro, se extrae
    if explicacion.startswith("{"):
        try:
            datos = json.loads(explicacion)
            if isinstance(datos, dict):
                for clave in ("explicacion", "explanation", "texto", "answer"):
                    if clave in datos:
                        explicacion = str(datos[clave]).strip()
                        break
        except json.JSONDecodeError:
            pass

    if not _explicacion_valida(explicacion, enunciado):
        print("    explicación descartada: no supera la validación", flush=True)
        return None

    return explicacion


def main_normal():
    """Modo normal: 30 preguntas para `js/quiz.js`."""
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


def main_pool(cantidad, desde_cero=False):
    """Modo pool: N preguntas para `js/quiz_pool.json`.

    No modifica `js/quiz.js`: el pool es un fichero aparte que el frontend
    usa para montar una partida distinta en cada juego.

    La generación avanza fragmento a fragmento y se guarda el progreso en
    `logs/pool_cache.json` cada `CHECKPOINT_CADA` preguntas, de modo que la
    ejecución se puede cortar y reanudar sin perder lo ya generado. Con
    `desde_cero=True` la caché anterior se aparta y se empieza de nuevo.
    """
    inicio = time.time()
    if cantidad <= 0:
        print("El número de preguntas del pool debe ser mayor que cero.")
        return

    conn = config.conexion()
    try:
        fragmentos = cargar_fragmentos(conn)
    finally:
        conn.close()

    if not fragmentos:
        print("La base de datos está vacía. Ejecuta antes: python backend/ingest.py")
        return

    print(f"Fragmentos en la base de datos: {len(fragmentos)}")
    print(f"Objetivo del pool: {cantidad} preguntas")
    print(f"Caché del pool: {config.RUTA_CACHE_POOL}")

    if desde_cero and config.RUTA_CACHE_POOL.exists():
        apartada = config.RUTA_CACHE_POOL.with_name("pool_cache_anterior.json")
        config.RUTA_CACHE_POOL.replace(apartada)
        print(f"Modo desde cero: caché anterior apartada en {apartada}")

    preguntas_cache = [] if desde_cero else cargar_cache(config.RUTA_CACHE_POOL)
    if preguntas_cache:
        print(f"Preguntas recuperadas de la caché: {len(preguntas_cache)}")

    # Se seleccionan algo más de fragmentos de los necesarios porque parte
    # de las preguntas se descartan y así queda material de sobra.
    contextos = seleccionar_chunks_para_pool(fragmentos, int(cantidad * 1.2))
    ya_usados = {p["contexto_id"] for p in preguntas_cache}
    contextos = [c for c in contextos if c["id"] not in ya_usados]
    print(f"Contextos seleccionados: {len(contextos)}")

    # Si la selección se queda corta, se añaden fragmentos adicionales del
    # resto del material (también con reparto proporcional).
    if len(contextos) < cantidad - len(preguntas_cache):
        print("Se amplian los contextos con fragmentos adicionales...")
        extras = [f for f in fragmentos if f["id"] not in ya_usados]
        extras = seleccionar_chunks_para_pool(
            extras, cantidad - len(preguntas_cache)
        )
        ya_contextos = {c["id"] for c in contextos}
        contextos += [c for c in extras if c["id"] not in ya_contextos]
        print(f"Contextos totales tras ampliar: {len(contextos)}")

    # Bucle principal: se pide al modelo de tres en tres, que es mucho más
    # rápido que de una en una. La validación, la deduplicación y el guardado
    # del progreso son los mismos.
    pool = generar_preguntas_pool(
        contextos,
        objetivo=cantidad,
        ruta_cache=config.RUTA_CACHE_POOL,
        pool_previo=preguntas_cache,
    )

    if len(pool) < cantidad:
        print(
            f"Aviso: solo se han juntado {len(pool)} de las {cantidad} "
            "preguntas pedidas. Relanza el comando para continuar: la caché "
            "guarda lo ya generado."
        )

    # Fusión final con la caché: no se sobrescribe lo anterior
    pool = deduplicar_pool(cargar_cache(config.RUTA_CACHE_POOL) + pool)
    pool = recortar_equilibrado(pool, cantidad)
    barajar_opciones(pool)
    escribir_pool_json(pool)
    guardar_cache(pool, config.RUTA_CACHE_POOL)
    print(f"Tiempo total: {round(time.time() - inicio, 1)} s")


def _son_duplicadas_con_pool(pregunta, pool, umbral=0.5):
    """Indica si la pregunta ya existe en el pool."""
    for otra in pool:
        if _son_duplicadas(pregunta, otra, umbral=umbral):
            return True
    return False


if __name__ == "__main__":
    main()
