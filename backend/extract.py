"""Extracción de texto y tablas de los PDF.

Se usa PyMuPDF para extraer bloques de texto con su posición (permite
reordenar columnas y descartar cabeceras/pies repetidos) y pdfplumber para
extraer las tablas, que se guardan aparte como fragmentos de tipo 'tabla'.
"""

import re
import unicodedata

import pdfplumber
import pymupdf

# Expresiones regulares para detectar cabeceras y pies de página repetidos
RE_CABECERA = re.compile(
    r"(p[áa]gina\s*\d+|-\s*\d+\s*-|MD\.|PlantillaTexto|gu[ií]a de la administraci[óo]n p[úu]blica)", re.I
)
RE_ESPACIOS = re.compile(r"[ \t]+")
RE_SALTOS = re.compile(r"\n{3,}")
# Palabras partidas a final de línea ("perso-\nnas" -> "personas")
RE_PARTIDAS = re.compile(r"(\w)-\n(\w)")


def _normalizar(texto: str) -> str:
    """Limpia espacios sobrantes y saltos de línea repetidos."""
    texto = texto.replace("\r", "")
    texto = RE_PARTIDAS.sub(r"\1\2", texto)
    texto = RE_ESPACIOS.sub(" ", texto)
    texto = RE_SALTOS.sub("\n\n", texto)
    return texto.strip()


def _es_basura(bloque: str) -> bool:
    """Indica si un bloque es una cabecera/pie o un fragmento sin contenido útil."""
    limpio = bloque.strip()
    if len(limpio) < 3:
        return True
    if RE_CABECERA.search(limpio) and len(limpio) < 120:
        return True
    # Bloque formado únicamente por dígitos o signos (números de página sueltos)
    if re.fullmatch(r"[\W\d_]+", limpio, flags=re.UNICODE):
        return True
    return False


def _reordenar_bloques(bloques, ancho_pagina):
    """Reordena los bloques de una página respetando columnas.

    Los bloques se agrupan por franjas verticales (misma línea base) y, si la
    página tiene dos columnas, se lee primero la columna izquierda.
    """
    utiles = [b for b in bloques if not _es_basura(b[4])]
    if not utiles:
        return []

    # Centro de la página: sirve para detectar la separación entre columnas
    centro = ancho_pagina / 2.0
    izq, der = [], []
    for b in utiles:
        (izq if (b[0] + b[2]) / 2.0 < centro else der).append(b)

    def ordenar_por_y(lista):
        return sorted(lista, key=lambda b: (round(b[1], 1), b[0]))

    izq = ordenar_por_y(izq)
    der = ordenar_por_y(der)

    # Si ambas zonas tienen contenido relevante, se puede estar ante un texto
    # a dos columnas: en ese caso se intercalan por altura de bloque.
    if izq and der and len(der) > 2:
        combinado = []
        while izq or der:
            if not der:
                combinado.append(izq.pop(0))
            elif not izq:
                combinado.append(der.pop(0))
            elif izq[0][1] <= der[0][1]:
                combinado.append(izq.pop(0))
            else:
                combinado.append(der.pop(0))
        return combinado

    return izq + der


def extraer_texto(ruta_pdf):
    """Extrae el texto corrido del PDF.

    Devuelve una lista de diccionarios con las claves: pagina y contenido.
    """
    documento = pymupdf.open(ruta_pdf)
    paginas = []
    for numero, pagina in enumerate(documento, start=1):
        bloques = pagina.get_text("blocks")
        ordenados = _reordenar_bloques(bloques, pagina.rect.width)
        texto = "\n".join(b[4].strip() for b in ordenados if b[4].strip())
        texto = _normalizar(texto)
        if texto:
            paginas.append({"pagina": numero, "contenido": texto})
    documento.close()
    return paginas


def _tabla_a_texto(tabla):
    """Convierte una tabla (lista de filas) en texto estructurado legible.

    Si la tabla solo tiene una columna (cajas de texto de las guías, que
    pdfplumber detecta como tablas) se devuelve el texto sin separadores.
    """
    if not tabla:
        return ""
    filas = []
    for fila in tabla:
        celdas = [(c or "").replace("\n", " ").strip() for c in fila]
        # Se descartan filas completamente vacías
        if any(celdas):
            filas.append(celdas)
    if not filas:
        return ""
    num_columnas = max(len(f) for f in filas)
    if num_columnas <= 1:
        return "\n".join(f[0] for f in filas if f[0])
    return "\n".join(" | ".join(f) for f in filas)


def extraer_tablas(ruta_pdf):
    """Extrae las tablas del PDF con pdfplumber.

    Devuelve una lista de diccionarios con las claves: pagina y contenido.
    """
    tablas = []
    with pdfplumber.open(ruta_pdf) as pdf:
        for numero, pagina in enumerate(pdf.pages, start=1):
            try:
                halladas = pagina.extract_tables() or []
            except Exception:
                halladas = []
            for tabla in halladas:
                texto = _normalizar(_tabla_a_texto(tabla))
                if len(texto) >= 20:
                    tablas.append({"pagina": numero, "contenido": texto})
    return tablas


def _sin_acentos(texto):
    """Elimina acentos para comparar textos de forma tolerante."""
    normal = unicodedata.normalize("NFD", texto)
    return "".join(c for c in normal if unicodedata.category(c) != "Mn")


def extraer_pdf(ruta_pdf, ruta_relativa):
    """Extrae todo el contenido de un PDF.

    Devuelve una lista de fragmentos: {ruta_pdf, pagina, tipo, contenido}.
    """
    fragmentos = []

    for pagina in extraer_texto(ruta_pdf):
        fragmentos.append(
            {
                "ruta_pdf": ruta_relativa,
                "pagina": pagina["pagina"],
                "tipo": "texto",
                "contenido": pagina["contenido"],
            }
        )

    for tabla in extraer_tablas(ruta_pdf):
        fragmentos.append(
            {
                "ruta_pdf": ruta_relativa,
                "pagina": tabla["pagina"],
                "tipo": "tabla",
                "contenido": tabla["contenido"],
            }
        )

    return fragmentos
