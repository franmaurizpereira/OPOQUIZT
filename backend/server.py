"""Servidor web de OPOQUIZ.

Sirve la interfaz estática y expone el historial de partidas terminadas.

Uso:
    python3 backend/server.py [--port 8099]

Rutas:
    GET  /api/partidas        → {"partidas": [...]} (más reciente primero)
    POST /api/partidas        → {"aciertos": n, "fallos": n} → 201 con la lista
    GET  /index.html, /css/*, /js/*
                                → interfaz estática

A diferencia de `python3 -m http.server`, aquí **solo** se sirven las rutas
permitidas: el resto del proyecto (credenciales, backend, repositorio) no es
accesible desde el navegador.
"""

import argparse
import json
import mimetypes
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config
import historial

RAIZ = config.RAIZ

# Rutas estáticas que se pueden servir
FICHEROS_PERMITIDOS = ("index.html",)
CARPETAS_PERMITIDAS = ("css", "js")

# Tamaño máximo del cuerpo de una petición POST (1 MiB es de sobra)
TAMANO_MAXIMO_CUERPO = 1024 * 1024

# Lock para que las escrituras del historial no se pisen entre sí
LOCK_ESCRITURA = threading.Lock()


class Manejador(BaseHTTPRequestHandler):
    """Peticiones HTTP del servidor de OPOQUIZ."""

    server_version = "OPOQUIZ/1.0"

    # ------------------------------------------------------------- estático

    def do_GET(self):  # noqa: N802 (nombre impuesto por http.server)
        ruta = urlparse(self.path).path
        if ruta == "/api/partidas":
            self._enviar_json(200, {"partidas": historial.leer_partidas()})
            return
        if ruta == "/":
            self.send_response(302)
            self.send_header("Location", "/index.html")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self._servir_estatico(ruta)

    def do_HEAD(self):  # noqa: N802
        self.do_GET()

    def do_POST(self):  # noqa: N802
        ruta = urlparse(self.path).path
        if ruta != "/api/partidas":
            self._enviar_json(404, {"error": "ruta no encontrada"})
            return

        cuerpo = self._leer_cuerpo()
        if cuerpo is None:
            return

        try:
            datos = json.loads(cuerpo.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._enviar_json(400, {"error": "cuerpo JSON no válido"})
            return

        if not isinstance(datos, dict):
            self._enviar_json(400, {"error": "cuerpo JSON no válido"})
            return

        aciertos, fallos = historial.validar_puntuacion(
            datos.get("aciertos"), datos.get("fallos")
        )
        if aciertos is None:
            self._enviar_json(
                400, {"error": "puntuación no válida: aciertos y fallos deben sumar 30"}
            )
            return

        with LOCK_ESCRITURA:
            partidas = historial.guardar_partida(aciertos, fallos)

        if partidas is None:
            self._enviar_json(400, {"error": "no se ha podido guardar la partida"})
            return

        self._enviar_json(201, {"partidas": partidas})

    # --------------------------------------------------------- utilidades

    def _leer_cuerpo(self):
        """Lee el cuerpo de la petición. Devuelve None si ya se ha respondido."""
        try:
            longitud = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            self._enviar_json(400, {"error": "Content-Length no válido"})
            return None

        if longitud <= 0:
            self._enviar_json(400, {"error": "cuerpo vacío"})
            return None

        if longitud > TAMANO_MAXIMO_CUERPO:
            self._enviar_json(413, {"error": "cuerpo demasiado grande"})
            return None

        return self.rfile.read(longitud)

    def _enviar_json(self, codigo, datos):
        """Envía una respuesta JSON."""
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(cuerpo)

    def _enviar_error(self, codigo, mensaje):
        """Envía un error en texto plano."""
        cuerpo = mensaje.encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(cuerpo)

    def _servir_estatico(self, ruta):
        """Sirve un fichero estático de las rutas permitidas."""
        relativa = unquote(ruta).lstrip("/")
        if not relativa:
            relativa = "index.html"

        # Solo se permiten los ficheros y carpetas definidos arriba
        permitted = False
        if relativa in FICHEROS_PERMITIDOS:
            permitted = True
        elif "/" in relativa:
            carpeta = relativa.split("/", 1)[0]
            permitted = carpeta in CARPETAS_PERMITIDAS

        if not permitted:
            self._enviar_error(404, "404 · no encontrado")
            return

        destino = (RAIZ / relativa).resolve()
        # Comprobación extra: el fichero debe estar dentro del proyecto
        if not str(destino).startswith(str(RAIZ.resolve())):
            self._enviar_error(404, "404 · no encontrado")
            return

        if not destino.is_file():
            self._enviar_error(404, "404 · no encontrado")
            return

        tipo = mimetypes.guess_type(str(destino))[0] or "application/octet-stream"
        if tipo.startswith("text/") or tipo in ("application/javascript",):
            tipo = f"{tipo}; charset=utf-8"

        datos = destino.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(datos)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(datos)

    def log_message(self, formato, *args):
        """Log más sobrio que el de http.server."""
        sys.stderr.write("%s · %s\n" % (self.log_date_time_string(), formato % args))


def main():
    analizador = argparse.ArgumentParser(description="Servidor web de OPOQUIZ")
    analizador.add_argument("--port", type=int, default=8099, help="puerto de escucha")
    analizador.add_argument("--host", default="127.0.0.1", help="dirección de escucha")
    argumentos = analizador.parse_args()

    servidor = ThreadingHTTPServer((argumentos.host, argumentos.port), Manejador)
    print(f"OPOQUIZ servido en http://{argumentos.host}:{argumentos.port}/index.html")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        servidor.server_close()


if __name__ == "__main__":
    main()
