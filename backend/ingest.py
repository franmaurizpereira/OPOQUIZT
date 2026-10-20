"""Orquestador de la ingesta: extraer -> trocear -> embeber -> guardar en pgvector.

Uso:
    python backend/ingest.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config
import chunk as chunk_mod
import embed as embed_mod
import extract as extract_mod


def _aplicar_db_sql(conn):
    """Ejecuta backend/db.sql para garantizar el esquema y la extensión."""
    sql = (config.RAIZ / "backend" / "db.sql").read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def _insertar(conn, fragmentos, vectores):
    """Inserta los fragmentos y sus embeddings en la tabla chunks."""
    from pgvector.psycopg import register_vector

    register_vector(conn)
    with conn.cursor() as cur:
        for frag, vec in zip(fragmentos, vectores):
            cur.execute(
                """
                INSERT INTO chunks (ruta_pdf, pagina, tipo, contenido, embedding)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (frag["ruta_pdf"], frag["pagina"], frag["tipo"], frag["contenido"], vec),
            )
    conn.commit()


def ingestar(rutas=None, modelo=config.MODELO_EMBEDDINGS):
    """Procesa los PDF indicados (por defecto todos los de pdfs/)."""
    if rutas is None:
        rutas = sorted(config.DIR_PDFS.glob("*.pdf"))

    if not rutas:
        print("No hay PDF en", config.DIR_PDFS)
        return

    conn = config.conexion()
    try:
        _aplicar_db_sql(conn)

        for ruta in rutas:
            ruta_rel = str(ruta.relative_to(config.RAIZ))
            print(f"Procesando {ruta_rel} ...")

            # Se eliminan los fragmentos anteriores de este PDF para no duplicar
            with conn.cursor() as cur:
                cur.execute("DELETE FROM chunks WHERE ruta_pdf = %s", (ruta_rel,))
            conn.commit()

            fragmentos = extract_mod.extraer_pdf(ruta, ruta_rel)
            troceados = chunk_mod.trocear_fragmentos(fragmentos)
            if not troceados:
                print("  sin contenido utilizable")
                continue

            print(f"  {len(troceados)} fragmentos")
            vectores = embed_mod.generar_embeddings(
                [f["contenido"] for f in troceados], modelo=modelo
            )
            _insertar(conn, troceados, vectores)
            print("  guardado en la base de datos")

        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM chunks")
            total = cur.fetchone()[0]
        print(f"Total de fragmentos en la base de datos: {total}")
    finally:
        conn.close()


if __name__ == "__main__":
    ingestar()
