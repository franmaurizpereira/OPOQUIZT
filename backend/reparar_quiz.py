"""Detecta y repara preguntas solapadas en el banco publicado (`js/quiz.js`).

Dos preguntas con el mismo conjunto de opciones son, para el jugador, la misma
pregunta aunque estén redactadas de forma distinta. Este script:

  1. Lee `js/quiz.js` y busca grupos de preguntas solapadas.
  2. Conserva la primera pregunta de cada grupo.
  3. Sustituye las demás por preguntas nuevas generadas desde la base de
     datos vectorial, validadas y comprobadas contra las que se conservan.
  4. Reescribe `js/quiz.js` con el formato del proyecto.

Uso:
    python3 backend/reparar_quiz.py            # solo informa de los grupos
    python3 backend/reparar_quiz.py --reparar  # repara el banco
"""

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config
import generate_quiz as gen

# Umbral de solapamiento entre conjuntos de opciones
UMBRAL_SOLAPAMIENTO = 0.5

# Umbral de similitud entre enunciados
UMBRAL_ENUNCIADO = 0.6

# Similitud mínima de enunciado para dar por duplicadas dos preguntas que
# comparten el mismo texto de respuesta correcta
UMBRAL_ENUNCIADO_MISMA_RESPUESTA = 0.3

# Número máximo de intentos por pregunta a reparar
MAX_INTENTOS = 3


# ------------------------------------------------------------ lectura JS


def _desescapar(texto):
    """Convierte un literal de JavaScript en su valor real."""
    try:
        return json.loads('"' + texto + '"')
    except json.JSONDecodeError:
        return texto.replace('\\"', '"').replace("\\\\", "\\")


def leer_quiz_js(ruta=None):
    """Lee el banco de preguntas de js/quiz.js."""
    ruta = ruta or config.RUTA_QUIZ_JS
    texto = ruta.read_text(encoding="utf-8")

    preguntas = []
    patron = re.compile(
        r'pregunta:\s*"((?:[^"\\]|\\.)*)",\s*'
        r'opciones:\s*\[(.*?)\],\s*'
        r'correcta:\s*(\d+),\s*'
        r'explicacion:\s*"((?:[^"\\]|\\.)*)"',
        re.S,
    )

    for encontrado in patron.finditer(texto):
        crudos = re.findall(r'"((?:[^"\\]|\\.)*)"', encontrado.group(2))
        opciones = [_desescapar(c) for c in crudos]
        # Se quita el prefijo "A) " que añade el generador
        opciones = [re.sub(r'^[A-D]\)\s*', '', o) for o in opciones]
        preguntas.append(
            {
                "pregunta": _desescapar(encontrado.group(1)),
                "opciones": opciones,
                "correcta": int(encontrado.group(3)),
                "explicacion": _desescapar(encontrado.group(4)),
            }
        )

    return preguntas


# ---------------------------------------------------------- detección


def _similitud_opciones(opciones_a, opciones_b):
    """Proporción de opciones de A que aparecen (como texto) en B (0 a 1)."""
    def textos(opciones):
        return {gen._limpiar_texto(o) for o in opciones if gen._limpiar_texto(o)}

    ta = textos(opciones_a)
    tb = textos(opciones_b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta)


def _similitud_enunciados(enunciado_a, enunciado_b):
    """Similitud de Jaccard entre los enunciados."""
    pa = gen._palabras_significativas(enunciado_a)
    pb = gen._palabras_significativas(enunciado_b)
    if not pa or not pb:
        return 0.0
    return len(pa & pb) / len(pa | pb)


def _mismo_texto_correcto(pregunta_a, pregunta_b):
    """Indica si dos preguntas tienen exactamente el mismo texto correcto."""
    correcta_a = pregunta_a["opciones"][pregunta_a["correcta"]]
    correcta_b = pregunta_b["opciones"][pregunta_b["correcta"]]
    return gen._limpiar_texto(correcta_a) == gen._limpiar_texto(correcta_b)


def _son_duplicadas(pregunta_a, pregunta_b):
    """Decide si dos preguntas son en realidad la misma.

    Tres señales: el mismo conjunto de opciones, enunciados casi iguales o
    la misma respuesta correcta con enunciados parecidos (que es el caso
    más traicionero: el jugador ve la misma solución dos veces).
    """
    if _similitud_opciones(pregunta_a["opciones"], pregunta_b["opciones"]) >= UMBRAL_SOLAPAMIENTO:
        return True

    if _similitud_enunciados(pregunta_a["pregunta"], pregunta_b["pregunta"]) >= UMBRAL_ENUNCIADO:
        return True

    if (
        _mismo_texto_correcto(pregunta_a, pregunta_b)
        and _similitud_enunciados(pregunta_a["pregunta"], pregunta_b["pregunta"])
        >= UMBRAL_ENUNCIADO_MISMA_RESPUESTA
    ):
        return True

    return False


def grupos_solapados(preguntas, umbral=UMBRAL_SOLAPAMIENTO):
    """Agrupa las preguntas que son en realidad la misma.

    Devuelve una lista de grupos (listas de índices) con más de una pregunta.
    """
    grupos = []
    asignadas = set()

    for i, pregunta in enumerate(preguntas):
        if i in asignadas:
            continue
        grupo = [i]
        for j in range(i + 1, len(preguntas)):
            if j in asignadas:
                continue
            if _son_duplicadas(pregunta, preguntas[j]):
                grupo.append(j)
                asignadas.add(j)
        if len(grupo) > 1:
            asignadas.add(i)
            grupos.append(grupo)

    return grupos


# ------------------------------------------------------------ reparación


def _candidatos_contexto(fragmentos, conservadas, usados, semilla=20240517):
    """Elige fragmentos válidos para generar preguntas nuevas."""
    import random

    aleatorio = random.Random(semilla)
    enunciados = [p["pregunta"] for p in conservadas]
    candidatos = []

    for fragmento in fragmentos:
        if fragmento["id"] in usados:
            continue
        if len(fragmento["contenido"]) < 400:
            continue
        # El fragmento no debe parecerse a lo ya usado en las preguntas
        if any(
            gen._solapamiento(fragmento["contenido"], enunciado) > 0.5
            for enunciado in enunciados
        ):
            continue
        candidatos.append(fragmento)

    aleatorio.shuffle(candidatos)
    return candidatos


def _preguntas_nuevas(fragmentos, conservadas, cuantas, modelo=config.MODELO_LLM):
    """Pide al LLM preguntas nuevas que no se solapen con las conservadas."""
    usadas = {f["id"] for f in fragmentos if f.get("usado")}
    candidatos = _candidatos_contexto(fragmentos, conservadas, usadas)
    nuevas = []

    for contexto in candidatos:
        if len(nuevas) >= cuantas:
            break

        try:
            respuesta = gen._llamar_llm(
                gen.construir_prompt([contexto]), modelo=modelo, formato=gen.ESQUEMA_PREGUNTAS
            )
        except Exception as exc:  # noqa: BLE001 - se informa y se sigue
            print(f"    error del LLM: {exc}")
            continue

        datos = gen._extraer_json(respuesta)
        if not isinstance(datos, list):
            continue

        for item in datos:
            if not isinstance(item, dict):
                continue
            pregunta = gen.validar_pregunta(item, contexto)
            if not pregunta:
                continue
            # No debe solaparse con ninguna pregunta que se conserva
            if any(
                _son_duplicadas(pregunta, otra)
                for otra in conservadas + nuevas
            ):
                print("    descartada por solaparse con otra pregunta")
                continue
            _barajar_opciones(pregunta)
            nuevas.append(pregunta)
            break

    return nuevas


def _barajar_opciones(pregunta):
    """Baraja las opciones de una pregunta y recalcula la respuesta correcta."""
    import random

    correcta = pregunta["opciones"][pregunta["correcta"]]
    random.shuffle(pregunta["opciones"])
    pregunta["correcta"] = pregunta["opciones"].index(correcta)
    return pregunta


def main():
    analizador = argparse.ArgumentParser(description="Repara preguntas solapadas del quiz")
    analizador.add_argument(
        "--reparar", action="store_true", help="sustituye las preguntas solapadas"
    )
    argumentos = analizador.parse_args()

    preguntas = leer_quiz_js()
    print(f"Preguntas en {config.RUTA_QUIZ_JS.name}: {len(preguntas)}")

    grupos = grupos_solapados(preguntas)
    if not grupos:
        print("No hay preguntas solapadas: no hay nada que reparar.")
        return

    for grupo in grupos:
        print(f"Grupo solapado: preguntas {[i + 1 for i in grupo]}")
        print(f"  enunciado: {preguntas[grupo[0]]['pregunta'][:90]}")

    if not argumentos.reparar:
        print("\nEjecuta con --reparar para sustituirlas.")
        return

    # Se conservan las primeras de cada grupo y se reparan las demás
    a_reparar = [i for grupo in grupos for i in grupo[1:]]
    conservadas = [p for i, p in enumerate(preguntas) if i not in a_reparar]
    print(f"\nSe conservan {len(conservadas)} y se reparan {len(a_reparar)}")

    conn = config.conexion()
    try:
        fragmentos = gen.cargar_fragmentos(conn)
    finally:
        conn.close()

    nuevas = _preguntas_nuevas(fragmentos, conservadas, len(a_reparar))
    print(f"Preguntas nuevas generadas: {len(nuevas)}")

    if len(nuevas) < len(a_reparar):
        print(
            "Faltan preguntas por generar: se conservan las antiguas "
            "para no dejar el banco incompleto."
        )

    # Se sustituyen por orden, para que el banco siga en orden de lectura
    reparadas = list(preguntas)
    for posicion, indice in enumerate(a_reparar):
        if posicion >= len(nuevas):
            break
        reparadas[indice] = {
            "pregunta": nuevas[posicion]["pregunta"],
            "opciones": nuevas[posicion]["opciones"],
            "correcta": nuevas[posicion]["correcta"],
            "explicacion": nuevas[posicion]["explicacion"],
        }
        print(f"  pregunta {indice + 1} sustituida: {reparadas[indice]['pregunta'][:70]}")

    gen.escribir_quiz_js(reparadas)
    print(f"Escrito {config.RUTA_QUIZ_JS} con {len(reparadas)} preguntas")


if __name__ == "__main__":
    main()
