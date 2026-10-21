"""Verifica el pool de preguntas generado en `js/quiz_pool.json`.

Comprueba que el pool es utilizable por el frontend:
- que tiene al menos el número mínimo de preguntas,
- que ninguna está repetida (ni por enunciado ni por conjunto de opciones),
- que cada pregunta cumple el esquema que espera el juego,
- que los documentos están repartidos y ninguno acapara el pool.

Uso:
    .venv/bin/python backend/verificar_pool.py [fichero] [minimo]
"""

import json
import sys
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
RUTA_POR_DEFECTO = RAIZ / "js" / "quiz_pool.json"
MINIMO_POR_DEFECTO = 500
# El tope de concentración por documento que se exige al pool
MAXIMO_POR_PDF = 0.30


def obtener_fuentes(datos, fichero):
    """Devuelve el reparto por documento de las preguntas.

    El pool publicado (`js/quiz_pool.json`) solo lleva los cuatro campos
    que necesita el juego, así que el reparto se saca de la caché de
    generación (`logs/pool_cache.json`), que sí guarda de qué documento y
    fragmento salió cada pregunta.
    """
    if datos and "fuente" in datos[0]:
        guardadas = datos
    else:
        cache = RAIZ / "logs" / "pool_cache.json"
        guardadas = []
        if cache.exists():
            try:
                guardadas = json.loads(cache.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                guardadas = []

    # La fuente es "documento.pdf (pág. N)": se agrupa por documento
    return Counter(
        p.get("fuente", "sin fuente").split(" (pág.")[0].strip() for p in guardadas
    )


def comprobar(fichero, minimo):
    """Devuelve (ok, lista de problemas)."""
    problemas = []

    if not fichero.exists():
        return False, [f"el fichero {fichero} no existe"]

    try:
        datos = json.loads(fichero.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return False, [f"el pool no es un JSON válido: {exc}"]

    if not isinstance(datos, list):
        return False, ["el pool no es una lista de preguntas"]

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

    return not problemas, problemas


def main():
    fichero = Path(sys.argv[1]) if len(sys.argv) > 1 else RUTA_POR_DEFECTO
    minimo = int(sys.argv[2]) if len(sys.argv) > 2 else MINIMO_POR_DEFECTO

    ok, problemas = comprobar(fichero, minimo)

    if not fichero.exists():
        print(f"El pool no existe todavía: {fichero}")
        return 1

    datos = json.loads(fichero.read_text(encoding="utf-8"))
    print(f"Pool: {fichero}")
    print(f"Preguntas: {len(datos)} (mínimo exigido: {minimo})")

    fuentes = obtener_fuentes(datos, fichero)
    if fuentes and fuentes.total():
        print(f"Documentos cubiertos: {len(fuentes)}")
        for fuente, numero in fuentes.most_common():
            print(f"  {numero:4d} ({numero / fuentes.total():5.1%})  {fuente}")
    else:
        print("Documentos cubiertos: sin datos (no hay caché de generación)")

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

    if problemas:
        print("\nProblemas encontrados:")
        for problema in problemas:
            print(f"  - {problema}")
        return 1

    print("\nEl pool cumple todos los requisitos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
