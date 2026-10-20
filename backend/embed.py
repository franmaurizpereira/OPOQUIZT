"""Generación de embeddings con Ollama en local.

Modelo por defecto: locusai/all-minilm-l6-v2:latest (dimensión 384).
"""

import json
import urllib.error
import urllib.request

from config import MODELO_EMBEDDINGS, URL_OLLAMA


def _pedir_embeddings(textos, modelo=MODELO_EMBEDDINGS, url=URL_OLLAMA):
    """Llama a la API de embeddings de Ollama y devuelve la lista de vectores."""
    cuerpo = json.dumps({"model": modelo, "input": textos}).encode("utf-8")
    peticion = urllib.request.Request(
        f"{url}/api/embed",
        data=cuerpo,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(peticion, timeout=300) as respuesta:
        datos = json.loads(respuesta.read().decode("utf-8"))
    return datos["embeddings"]


def generar_embeddings(textos, modelo=MODELO_EMBEDDINGS, lote=8, url=URL_OLLAMA):
    """Genera los embeddings de una lista de textos.

    Se envia en lotes para no saturar el servidor local de Ollama.
    """
    vectores = []
    for i in range(0, len(textos), lote):
        grupo = textos[i : i + lote]
        vectores.extend(_pedir_embeddings(grupo, modelo=modelo, url=url))
        print(f"  embeddings {min(i + lote, len(textos))}/{len(textos)}")
    return vectores


def embedding_texto(texto, modelo=MODELO_EMBEDDINGS, url=URL_OLLAMA):
    """Genera el embedding de un único texto."""
    return _pedir_embeddings([texto], modelo=modelo, url=url)[0]
