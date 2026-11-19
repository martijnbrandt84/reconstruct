"""Lokale server voor Reconstruct zonder browsercache, zodat elke wijziging direct zichtbaar is.

Gebruik:  python tools/serve.py [poort]   (standaard 8777)
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


if __name__ == '__main__':
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler) as httpd:
        print(f'Reconstruct op http://localhost:{PORT}/index.html  (map: {ROOT})')
        httpd.serve_forever()
