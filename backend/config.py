"""Configuración común del backend: credenciales, rutas y modelos."""

import os
import re
from pathlib import Path

import yaml

# Raíz del proyecto (carpeta que contiene backend/, pdfs/, js/ ...)
RAIZ = Path(__file__).resolve().parent.parent

# Fichero de credenciales de la base de datos
RUTA_CREDENCIALES = RAIZ / "credencial.yaml"

# Directorio con los PDF de origen
DIR_PDFS = RAIZ / "pdfs"

# Fichero de preguntas generado
RUTA_QUIZ_JS = RAIZ / "js" / "quiz.js"

# Caché propia del pool (no se comparte con la del modo normal)
RUTA_CACHE_POOL = RAIZ / "logs" / "pool_cache.json"

# Modelos de Ollama usados en local
MODELO_EMBEDDINGS = "locusai/all-minilm-l6-v2:latest"
MODELO_LLM = "qwen3.8:27b"
URL_OLLAMA = os.environ.get("OLLAMA_URL", "http://localhost:11434")

# OpenRouter (opcional): si hay clave, el generador de preguntas usa el
# modelo remoto en vez del modelo local de Ollama. Es mucho más rápido,
# aunque el juego sigue funcionando sin conexión: el pool ya está generado.
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
# El modelo `:free` de minimax desapareció de OpenRouter (404) y su
# proveedor rechaza las peticiones sin saldo prepago (402). DeepSeek Flash
# responde siempre, es rápido y cuesta ~0,10 $ por un pool de 2.100
# preguntas. Se puede cambiar con la variable OPENROUTER_MODEL.
MODELO_LLM_OPENROUTER = os.environ.get(
    "OPENROUTER_MODEL", "deepseek/deepseek-v4-flash"
)
URL_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions"
# Identificación de la aplicación en OpenRouter (opcional pero recomendable)
OPENROUTER_TITULO = "OPOQUIZ"

# Dimensión del vector de embeddings (all-MiniLM-L6-v2 -> 384)
DIMENSION_EMBEDDING = 384

# Fichero del pool de preguntas (modo --pool)
QUIZ_POOL_PATH = RAIZ / "js" / "quiz_pool.json"


# Temarios del pool: fragmento que identifica el PDF y etiqueta que ve el
# jugador. El orden es el de los documentos. Se identifica por un trozo del
# nombre y no por el prefijo numérico porque uno de los PDF no lo lleva.
TEMAS_PDF = (
    ("Constitucion_Española", "Constitución Española"),
    ("Cortes_Generales", "Cortes Generales"),
    ("Gobierno_composicion", "Gobierno"),
    ("texto_refundido_Estatuto_Basico", "Estatuto Básico del Empleado Público"),
    ("Igualdad de Genero", "Igualdad y violencia de género"),
    ("proteccion_datos_personales", "Protección de datos"),
    ("Acceso_electronico_ciudadanos", "Acceso electrónico de los ciudadanos"),
    ("La_sociedad_informacion", "Sociedad de la información"),
    ("Instrumentos_para_acceso_electronico", "Instrumentos de acceso electrónico"),
)


def _nombre_documento(fuente):
    """Devuelve el nombre del PDF sin carpeta, extensión ni prefijo numérico."""
    nombre = str(fuente or "").split(" (pág.")[0].rsplit("/", 1)[-1]
    nombre = re.sub(r"\.pdf$", "", nombre, flags=re.IGNORECASE)
    return re.sub(r"^\d+[_\-]", "", nombre).strip()


def tema_de_fuente(fuente):
    """Devuelve la etiqueta del temario a partir de la fuente de una pregunta.

    `fuente` tiene la forma "documento.pdf (pág. N)". La coincidencia es por
    **prefijo** del nombre del documento, no por subcadena: si no, el PDF de
    Gobierno (que menciona las Cortes Generales en su título) se confundiría
    con el de Cortes Generales. Si el documento no está en la lista se
    devuelve su nombre limpio en vez de fallar: un PDF nuevo no debe romper
    la generación del pool.
    """
    nombre = _nombre_documento(fuente)
    for fragmento, etiqueta in TEMAS_PDF:
        if nombre.lower().startswith(fragmento.lower()):
            return etiqueta

    return nombre.replace("_", " ").strip()[:80] or "General"


def leer_credenciales() -> dict:
    """Lee el fichero credencial.yaml y devuelve sus datos."""
    with open(RUTA_CREDENCIALES, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def conexion():
    """Devuelve una conexión psycopg a la base de datos configurada."""
    import psycopg

    c = leer_credenciales()
    return psycopg.connect(
        host=c.get("host", "localhost"),
        port=int(c.get("port", 5432)),
        user=c["user"],
        password=c["passwd"],
        dbname=c.get("database", "postgres"),
    )
