"""Historial de partidas terminadas.

Se guarda en un fichero local (`data/partidas.json`), no en la base de datos:
el usuario decidió (spec 001, decisión D1) no crear ninguna tabla nueva.

Formato del fichero:
    {
      "partidas": [
        {"fecha": "2026-01-12T10:23:45", "aciertos": 21, "fallos": 9}
      ]
    }

La fecha se guarda como marca de tiempo local en ISO (sin zona horaria): así
se ordena por el instante real aunque dos partidas caigan el mismo día.

A partir de la spec 004 cada partida puede llevar además su `detalle`: la
revisión completa (enunciado, opciones, opción elegida, correcta, resultado y
explicación de cada pregunta). El detalle solo se conserva de las partidas
más recientes (ver `MAXIMO_CON_DETALLE`): así el fichero no crece sin límite
y las partidas antiguas siguen mostrando su fecha y su puntuación.
"""

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path

import config

# Fichero con el historial (estado local del equipo, ignorado por git).
# La variable de entorno OPOQUIZ_HISTORIAL permite usar otro fichero, por
# ejemplo en las pruebas automáticas, para no tocar el historial real.
RUTA_HISTORIAL = Path(
    os.environ.get("OPOQUIZ_HISTORIAL") or (config.RAIZ / "data" / "partidas.json")
)

# Número máximo de partidas que se conservan en el fichero
MAX_PARTIDAS = 100

# Número de partidas más recientes que conservan el detalle de la revisión.
# De las anteriores se poda el detalle, pero no se pierde la partida.
MAXIMO_CON_DETALLE = 20

# Total de preguntas de una partida completa
TOTAL_PREGUNTAS = 30


def _ruta_legible() -> bool:
    """Indica si el fichero existe y se puede leer."""
    return RUTA_HISTORIAL.exists() and os.access(RUTA_HISTORIAL, os.R_OK)


def leer_partidas():
    """Devuelve la lista de partidas registradas, de la más reciente a la más antigua.

    El orden se garantiza aquí (y no depende del orden del fichero): la marca
    de tiempo en ISO se puede comparar como texto, así que el más nuevo
    siempre queda primero.

    Si el fichero no existe o está corrupto se devuelve una lista vacía: el
    historial nunca debe impedir jugar.
    """
    if not _ruta_legible():
        return []

    try:
        datos = json.loads(RUTA_HISTORIAL.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, UnicodeDecodeError):
        return []

    partidas = datos.get("partidas") if isinstance(datos, dict) else datos
    if not isinstance(partidas, list):
        return []

    validas = [p for p in partidas if _partida_valida(p)]
    # De la más reciente a la más antigua (orden inverso del texto ISO)
    validas.sort(key=lambda p: p["fecha"], reverse=True)
    return validas


def _partida_valida(partida) -> bool:
    """Comprueba que una entrada del historial tiene la forma esperada."""
    if not isinstance(partida, dict):
        return False
    fecha = partida.get("fecha")
    aciertos = partida.get("aciertos")
    fallos = partida.get("fallos")
    if not isinstance(fecha, str) or not fecha:
        return False
    if not isinstance(aciertos, int) or not isinstance(fallos, int):
        return False
    return 0 <= aciertos <= TOTAL_PREGUNTAS and 0 <= fallos <= TOTAL_PREGUNTAS


def validar_detalle(detalle):
    """Valida el detalle de una partida (la revisión).

    Devuelve el detalle limpio (una lista de preguntas) o None si no es
    válido. Se aceptan también listas vacías: una partida puede haberse
    registrado sin detalle (por ejemplo, si se cortó la partida).
    """
    if detalle is None:
        return None
    if not isinstance(detalle, list):
        return None
    if len(detalle) == 0:
        return []
    if len(detalle) > TOTAL_PREGUNTAS:
        return None

    limpio = []
    for pregunta in detalle:
        if not isinstance(pregunta, dict):
            return None

        enunciado = pregunta.get("pregunta")
        opciones = pregunta.get("opciones")
        correcta = pregunta.get("correcta")
        elegida = pregunta.get("elegida", -1)
        acertada = pregunta.get("acertada", False)
        contestada = pregunta.get("contestada", True)
        explicacion = pregunta.get("explicacion", "")

        if not isinstance(enunciado, str) or not enunciado.strip():
            return None
        if not isinstance(opciones, list) or len(opciones) != 4:
            return None
        if any(not isinstance(opcion, str) or not opcion.strip() for opcion in opciones):
            return None
        if not isinstance(correcta, int) or not 0 <= correcta <= 3:
            return None
        if not isinstance(elegida, int) or not -1 <= elegida <= 3:
            return None
        if not isinstance(acertada, bool) or not isinstance(contestada, bool):
            return None
        if not isinstance(explicacion, str):
            return None

        limpio.append(
            {
                "pregunta": enunciado,
                "opciones": list(opciones),
                "correcta": correcta,
                "elegida": elegida,
                "acertada": acertada,
                "contestada": contestada,
                "explicacion": explicacion,
            }
        )

    return limpio


def validar_puntuacion(aciertos, fallos):
    """Valida una puntuación antes de registrarla.

    Devuelve (aciertos, fallos) como enteros si son correctos y
    (None, None) en caso contrario.
    """
    if isinstance(aciertos, bool) or isinstance(fallos, bool):
        return None, None
    if not isinstance(aciertos, int) or not isinstance(fallos, int):
        return None, None
    if aciertos < 0 or fallos < 0:
        return None, None
    if aciertos > TOTAL_PREGUNTAS or fallos > TOTAL_PREGUNTAS:
        return None, None
    if aciertos + fallos != TOTAL_PREGUNTAS:
        return None, None
    return aciertos, fallos


def _escribir(partidas):
    """Escribe el historial de forma atómica (fichero temporal y reemplazo)."""
    RUTA_HISTORIAL.parent.mkdir(parents=True, exist_ok=True)

    descriptor, temporal = tempfile.mkstemp(
        dir=str(RUTA_HISTORIAL.parent), prefix=".partidas-", suffix=".tmp"
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as fichero:
            json.dump({"partidas": partidas}, fichero, ensure_ascii=False, indent=2)
        os.replace(temporal, RUTA_HISTORIAL)
    except Exception:
        # Si algo falla, no se deja el fichero temporal por ahí
        try:
            os.unlink(temporal)
        except OSError:
            pass
        raise


def guardar_partida(aciertos, fallos, detalle=None):
    """Registra una partida terminada y devuelve el historial completo.

    La partida nueva se coloca al principio (la más reciente). Si la
    puntuación no es válida no se escribe nada y se devuelve None.

    El `detalle` (la revisión de la partida) es opcional: si no es válido se
    guarda la partida sin él. Solo las partidas más recientes conservan el
    detalle; de las anteriores se poda para que el fichero no crezca.
    """
    aciertos, fallos = validar_puntuacion(aciertos, fallos)
    if aciertos is None:
        return None

    partida = {
        "fecha": datetime.now().isoformat(timespec="seconds"),
        "aciertos": aciertos,
        "fallos": fallos,
    }

    detalle_limpio = validar_detalle(detalle)
    if detalle_limpio:
        partida["detalle"] = detalle_limpio

    partidas = [partida] + leer_partidas()
    partidas = partidas[:MAX_PARTIDAS]

    # Solo las partidas más recientes conservan el detalle de la revisión
    for indice, anterior in enumerate(partidas):
        if indice >= MAXIMO_CON_DETALLE:
            anterior.pop("detalle", None)

    _escribir(partidas)
    return partidas
