"""Troceado (chunking) del texto extraído de los PDF.

El troceado respeta las unidades semánticas: párrafos completos, filas de
tabla y secciones. Nunca se cortan palabras a mitad.
"""

# Tamaño máximo aproximado de un fragmento (en caracteres)
TAMANO_MAXIMO = 1200
# Tamaño mínimo para descartar fragmentos demasiado pequeños
TAMANO_MINIMO = 80


def trocear_texto(texto, tamano_maximo=TAMANO_MAXIMO):
    """Divide un texto en párrafos completos agrupados por tamaño.

    Se respeta el límite de tamaño sin cortar palabras ni párrafos.
    """
    texto = (texto or "").strip()
    if not texto:
        return []

    parrafos = [p.strip() for p in texto.split("\n") if p.strip()]

    fragmentos = []
    actual = []
    longitud = 0

    for parrafo in parrafos:
        # Un párrafo demasiado largo se divide por frases, nunca por palabras
        if len(parrafo) > tamano_maximo:
            if actual:
                fragmentos.append("\n".join(actual))
                actual, longitud = [], 0
            for trozo in _dividir_por_frases(parrafo, tamano_maximo):
                fragmentos.append(trozo)
            continue

        if longitud + len(parrafo) + 1 > tamano_maximo and actual:
            fragmentos.append("\n".join(actual))
            actual, longitud = [], 0

        actual.append(parrafo)
        longitud += len(parrafo) + 1

    if actual:
        fragmentos.append("\n".join(actual))

    return [f for f in fragmentos if len(f) >= TAMANO_MINIMO]


def _dividir_por_frases(parrafo, tamano_maximo):
    """Divide un párrafo largo por finales de frase."""
    partes = parrafo.split(". ")
    trozos = []
    actual = ""
    for parte in partes:
        candidata = (actual + ". " + parte) if actual else parte
        if len(candidata) > tamano_maximo and actual:
            trozos.append(actual + ".")
            actual = parte
        else:
            actual = candidata
    if actual:
        trozos.append(actual)
    return [t for t in trozos if t.strip()]


def trocear_tabla(texto, tamano_maximo=TAMANO_MAXIMO):
    """Trocea una tabla por filas, manteniendo la cabecera en cada fragmento.

    Cada fragmento es un conjunto de filas completas, de forma que nunca se
    parte una celda por la mitad.
    """
    filas = [f.strip() for f in (texto or "").split("\n") if f.strip()]
    if not filas:
        return []

    cabecera = filas[0]
    cuerpo = filas[1:]

    fragmentos = []
    actual = []
    longitud = len(cabecera)

    for fila in cuerpo:
        if longitud + len(fila) + 1 > tamano_maximo and actual:
            fragmentos.append(cabecera + "\n" + "\n".join(actual))
            actual, longitud = [], len(cabecera)
        actual.append(fila)
        longitud += len(fila) + 1

    if actual:
        fragmentos.append(cabecera + "\n" + "\n".join(actual))

    return [f for f in fragmentos if len(f) >= TAMANO_MINIMO]


def trocear_fragmentos(fragmentos):
    """Trocea una lista de fragmentos extraídos.

    Devuelve una lista de fragmentos ya listos para generar embeddings.
    """
    resultado = []
    for frag in fragmentos:
        if frag["tipo"] == "tabla":
            trozos = trocear_tabla(frag["contenido"])
        else:
            trozos = trocear_texto(frag["contenido"])
        for trozo in trozos:
            resultado.append(
                {
                    "ruta_pdf": frag["ruta_pdf"],
                    "pagina": frag["pagina"],
                    "tipo": frag["tipo"],
                    "contenido": trozo,
                }
            )
    return resultado
