"""Verifica el pool de preguntas generado en `js/quiz_pool.json`.

Comprueba que el pool es utilizable por el frontend:
- que tiene al menos el número mínimo de preguntas,
- que cada pregunta lleva su tema, con las 9 etiquetas conocidas,
- que ningún tema baja de 50 preguntas,
- que ninguna pregunta está repetida (ni por enunciado ni por opciones),
- que cada pregunta cumple el esquema que espera el juego,
- que no hay texto en inglés ni explicaciones que hablan de «el texto»,
- que la respuesta correcta está repartida entre las cuatro posiciones,
- y, si hay base de datos, cuánto **texto** y cuántas **páginas** cubre
  el pool (objetivo: 90 % del texto, 85 % por documento y 95 % de las
  páginas).

Uso:
    .venv/bin/python backend/verificar_pool.py [fichero] [minimo]
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

import config

RAIZ = Path(__file__).resolve().parent.parent
RUTA_POR_DEFECTO = RAIZ / "js" / "quiz_pool.json"
RUTA_CACHE = RAIZ / "logs" / "pool_cache.json"
MINIMO_POR_DEFECTO = 1900
MINIMO_POR_TEMA = 50
# El tope de concentración por documento que se exige al pool
MAXIMO_POR_PDF = 0.30

# Cobertura mínima que se exige al pool sobre el texto de la base de datos
COBERTURA_TEXTO = 0.90
COBERTURA_POR_DOCUMENTO = 0.85
COBERTURA_PAGINAS = 0.95

# Etiquetas de tema que puede llevar una pregunta
TEMAS_VALIDOS = frozenset(etiqueta for _, etiqueta in config.TEMAS_PDF)

# Palabras que delatan una fuga de inglés en el enunciado o la explicación.
# Se buscan como palabras completas: «is» dentro de «Paris» no cuenta.
PALABRAS_INGLESAS = re.compile(
    r"\b(the|of|and|with|under|shall|protected|must|which|are|is|"
    r"that|this|from|between)\b",
    re.IGNORECASE,
)

# Expresiones que hacen que una explicación no se entienda sola.
# «el Texto Refundido» es el nombre de una ley y no cuenta.
PATRON_REFERENCIAS = re.compile(
    r"\b(el texto|el pasaje|el contexto|el fragmento)\b"
    r"(?!\s+(refundido|consolidado))",
    re.IGNORECASE,
)


def cargar_cache():
    """Devuelve las preguntas de la caché de generación, o una lista vacía."""
    if not RUTA_CACHE.exists():
        return []
    try:
        datos = json.loads(RUTA_CACHE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    return datos if isinstance(datos, list) else []


def obtener_fuentes(datos, fichero):
    """Devuelve el reparto por documento de las preguntas.

    El pool publicado lleva el tema de cada pregunta, así que el reparto
    sale de ahí. Si es un pool antiguo sin `tema`, se usa la caché de
    generación (`logs/pool_cache.json`), que guarda de qué documento salió
    cada pregunta.
    """
    if datos and datos[0].get("tema"):
        return Counter(p.get("tema", "sin tema") for p in datos)

    guardadas = cargar_cache()
    if datos and "fuente" in datos[0]:
        guardadas = datos

    return Counter(
        p.get("fuente", "sin fuente").split(" (pág.")[0].strip() for p in guardadas
    )


def ids_del_pool(datos):
    """Devuelve los `contexto_id` de las preguntas publicadas.

    El pool publicado no guarda el identificador del fragmento, pero la
    caché sí. Se emparejan por el enunciado, que es único (el verificador
    ya comprueba que no hay repetidos).
    """
    cache = cargar_cache()
    por_enunciado = {
        str(p.get("pregunta", "")).strip(): p.get("contexto_id") for p in cache
    }
    return {
        por_enunciado[texto]
        for texto in (str(p.get("pregunta", "")).strip() for p in datos)
        if texto in por_enunciado and por_enunciado[texto] is not None
    }


def cobertura(chunks, usados):
    """Mide qué parte del texto y de las páginas cubre el pool.

    `chunks` es una lista de tuplas `(id, ruta_pdf, pagina, longitud)` y
    `usados` el conjunto de identificadores con pregunta. Es una función
    pura: no toca la base de datos y se puede probar sin ella.
    """
    total_texto = 0
    texto_cubierto = 0
    paginas = {}
    for identificador, ruta, pagina, longitud in chunks:
        total_texto += longitud
        if identificador in usados:
            texto_cubierto += longitud
        clave = (ruta, pagina)
        # Una página cuenta como cubierta si al menos uno de sus fragmentos
        # tiene pregunta
        paginas[clave] = paginas.get(clave, False) or (identificador in usados)

    por_documento = {}
    for identificador, ruta, pagina, longitud in chunks:
        datos = por_documento.setdefault(
            ruta, {"texto": 0, "cubierto": 0, "paginas": set(), "cubiertas": set()}
        )
        datos["texto"] += longitud
        datos["paginas"].add(pagina)
        if identificador in usados:
            datos["cubierto"] += longitud
            datos["cubiertas"].add(pagina)

    for datos in por_documento.values():
        datos["texto_pct"] = (
            datos["cubierto"] / datos["texto"] if datos["texto"] else 0.0
        )
        datos["paginas_pct"] = (
            len(datos["cubiertas"]) / len(datos["paginas"]) if datos["paginas"] else 0.0
        )

    paginas_cubiertas = sum(1 for cubierta in paginas.values() if cubierta)

    return {
        "texto_total": total_texto,
        "texto_cubierto": texto_cubierto,
        "texto_pct": texto_cubierto / total_texto if total_texto else 0.0,
        "paginas": len(paginas),
        "paginas_cubiertas": paginas_cubiertas,
        "paginas_pct": paginas_cubiertas / len(paginas) if paginas else 0.0,
        "por_documento": por_documento,
    }


def cargar_chunks_bd():
    """Lee los fragmentos de la base de datos. Devuelve None si no hay BD."""
    try:
        with config.conexion() as conexion, conexion.cursor() as cursor:
            cursor.execute(
                "select id, ruta_pdf, pagina, length(contenido) from chunks"
            )
            return cursor.fetchall()
    except Exception:  # noqa: BLE001 - sin BD se sigue sin medir cobertura
        return None


def comprobar(fichero, minimo, chunks=None, usados=None):
    """Devuelve (ok, lista de problemas, informe de cobertura o None)."""
    problemas = []

    if not fichero.exists():
        return False, [f"el fichero {fichero} no existe"], None

    try:
        datos = json.loads(fichero.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return False, [f"el pool no es un JSON válido: {exc}"], None

    if not isinstance(datos, list):
        return False, ["el pool no es una lista de preguntas"], None

    if len(datos) < minimo:
        problemas.append(f"solo hay {len(datos)} preguntas (se piden {minimo})")

    # --- esquema de cada pregunta ---
    for numero, pregunta in enumerate(datos, start=1):
        if not isinstance(pregunta, dict):
            problemas.append(f"#{numero}: no es un objeto")
            continue
        if not str(pregunta.get("pregunta", "")).strip():
            problemas.append(f"#{numero}: enunciado vacío")
        opciones = pregunta.get("opciones")
        if not isinstance(opciones, list) or len(opciones) != 4:
            problemas.append(f"#{numero}: no tiene 4 opciones")
            continue
        if len({str(o).strip().lower() for o in opciones}) != 4:
            problemas.append(f"#{numero}: tiene opciones repetidas")
        correcta = pregunta.get("correcta")
        if not isinstance(correcta, int) or not 0 <= correcta <= 3:
            problemas.append(f"#{numero}: índice de correcta no válido")
        if len(str(pregunta.get("explicacion", "")).strip()) < 30:
            problemas.append(f"#{numero}: explicación demasiado corta")

    # --- tema de cada pregunta ---
    temas = Counter(str(p.get("tema", "")).strip() for p in datos)
    if temas.get(""):
        problemas.append(f"{temas['']} preguntas sin tema")
    desconocidos = {t for t in temas if t and t not in TEMAS_VALIDOS}
    if desconocidos:
        problemas.append(f"temas desconocidos: {', '.join(sorted(desconocidos))}")
    for tema, cuantas in temas.items():
        if tema and cuantas < MINIMO_POR_TEMA:
            problemas.append(
                f"el tema «{tema}» solo tiene {cuantas} preguntas "
                f"(mínimo {MINIMO_POR_TEMA})"
            )

    # --- duplicados ---
    enunciados = Counter(str(p.get("pregunta", "")).strip().lower() for p in datos)
    repetidos = [e for e, n in enunciados.items() if n > 1]
    if repetidos:
        problemas.append(f"{len(repetidos)} enunciados repetidos")

    conjuntos = Counter(
        tuple(sorted(str(o).strip().lower() for o in p.get("opciones", [])))
        for p in datos
    )
    repetidos_conj = [c for c, n in conjuntos.items() if n > 1]
    if repetidos_conj:
        problemas.append(f"{len(repetidos_conj)} preguntas con las mismas opciones")

    # --- fugas de inglés ---
    fugas = []
    for numero, pregunta in enumerate(datos, start=1):
        texto = f"{pregunta.get('pregunta', '')} {pregunta.get('explicacion', '')}"
        encontradas = PALABRAS_INGLESAS.findall(texto)
        if encontradas:
            fugas.append((numero, encontradas[0]))
    if fugas:
        ejemplo = ", ".join(f"#{n} «{p}»" for n, p in fugas[:3])
        problemas.append(f"{len(fugas)} preguntas con palabras en inglés ({ejemplo})")

    # --- explicaciones que no se entienden solas ---
    referencias = [
        numero
        for numero, p in enumerate(datos, start=1)
        if PATRON_REFERENCIAS.search(str(p.get("explicacion", "")))
    ]
    if referencias:
        problemas.append(
            f"{len(referencias)} explicaciones hablan de «el texto» "
            f"(p. ej. #{referencias[0]})"
        )

    # --- reparto por documento ---
    fuentes = obtener_fuentes(datos, fichero)
    if fuentes and fuentes.total():
        peor = fuentes.most_common(1)[0]
        porcentaje = peor[1] / len(datos)
        if porcentaje > MAXIMO_POR_PDF:
            problemas.append(
                f"el documento «{peor[0]}» concentra el {porcentaje:.1%} del pool "
                f"(máximo {MAXIMO_POR_PDF:.0%})"
            )

    # --- reparto de la respuesta correcta ---
    posiciones = Counter(p.get("correcta") for p in datos)
    if posiciones:
        peor = max(posiciones.values()) / len(datos)
        if peor > 0.40:
            problemas.append(
                f"la respuesta correcta está en la misma posición en el "
                f"{peor:.1%} de las preguntas (debería repartirse)"
            )

    # --- cobertura sobre la base de datos ---
    informe = None
    if chunks is not None and usados is not None:
        informe = cobertura(chunks, usados)
        if informe["texto_pct"] < COBERTURA_TEXTO:
            problemas.append(
                f"el pool cubre el {informe['texto_pct']:.1%} del texto "
                f"(mínimo {COBERTURA_TEXTO:.0%})"
            )
        if informe["paginas_pct"] < COBERTURA_PAGINAS:
            problemas.append(
                f"el pool llega al {informe['paginas_pct']:.1%} de las páginas "
                f"(mínimo {COBERTURA_PAGINAS:.0%})"
            )
        flojos = [
            nombre
            for nombre, datos_pdf in informe["por_documento"].items()
            if datos_pdf["texto_pct"] < COBERTURA_POR_DOCUMENTO
        ]
        if flojos:
            problemas.append(
                f"{len(flojos)} documentos por debajo del "
                f"{COBERTURA_POR_DOCUMENTO:.0%} de su texto: "
                + ", ".join(Path(n).name for n in sorted(flojos))
            )

    return not problemas, problemas, informe


def main():
    fichero = Path(sys.argv[1]) if len(sys.argv) > 1 else RUTA_POR_DEFECTO
    minimo = int(sys.argv[2]) if len(sys.argv) > 2 else MINIMO_POR_DEFECTO

    if not fichero.exists():
        print(f"El pool no existe todavía: {fichero}")
        return 1

    datos = json.loads(fichero.read_text(encoding="utf-8"))
    chunks = cargar_chunks_bd()
    usados = ids_del_pool(datos) if chunks is not None else None
    ok, problemas, informe = comprobar(fichero, minimo, chunks, usados)

    print(f"Pool: {fichero}")
    print(f"Preguntas: {len(datos)} (mínimo exigido: {minimo})")

    fuentes = obtener_fuentes(datos, fichero)
    if fuentes and fuentes.total():
        etiquetas = len({p.get("tema") for p in datos if p.get("tema")})
        print(f"Temas cubiertos: {etiquetas}")
        for fuente, numero in fuentes.most_common():
            print(f"  {numero:4d} ({numero / fuentes.total():5.1%})  {fuente}")
    else:
        print("Temas cubiertos: sin datos (no hay caché de generación)")

    posiciones = Counter(p.get("correcta") for p in datos)
    if posiciones:
        print("Posición de la respuesta correcta: ", end="")
        print(
            ", ".join(
                f"{['A', 'B', 'C', 'D'][pos]}={num} ({num / len(datos):.1%})"
                for pos, num in sorted(posiciones.items())
                if isinstance(pos, int)
            )
        )

    if informe:
        print("\nCobertura del texto (base de datos):")
        print(
            f"  global: {informe['texto_pct']:.1%} del texto · "
            f"{informe['paginas_pct']:.1%} de las páginas "
            f"({informe['paginas_cubiertas']}/{informe['paginas']})"
        )
        for nombre, datos_pdf in sorted(
            informe["por_documento"].items(),
            key=lambda x: x[1]["texto_pct"],
        ):
            print(
                f"  {datos_pdf['texto_pct']:5.1%} texto · "
                f"{datos_pdf['paginas_pct']:5.1%} páginas  {Path(nombre).name[:60]}"
            )
    else:
        print(
            "\nCobertura: no se puede medir (sin base de datos o sin caché "
            "de generación)"
        )

    if problemas:
        print("\nProblemas encontrados:")
        for problema in problemas:
            print(f"  - {problema}")
        return 1

    print("\nEl pool cumple todos los requisitos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
