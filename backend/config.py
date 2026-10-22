"""Configuración común del backend: credenciales, rutas y modelos."""

import os
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
MODELO_LLM_OPENROUTER = os.environ.get(
    "OPENROUTER_MODEL", "minimax/minimax-m3.1-flash:free"
)
URL_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions"
# Identificación de la aplicación en OpenRouter (opcional pero recomendable)
OPENROUTER_TITULO = "OPOQUIZ"

# Dimensión del vector de embeddings (all-MiniLM-L6-v2 -> 384)
DIMENSION_EMBEDDING = 384

# Fichero del pool de preguntas (modo --pool)
QUIZ_POOL_PATH = RAIZ / "js" / "quiz_pool.json"


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
