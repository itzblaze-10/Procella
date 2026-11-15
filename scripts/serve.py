#!/usr/bin/env python3
"""Serve the repository at http://localhost:8000/app/ with Cache-Control: no-cache.

    python3 scripts/serve.py

Plain `python3 -m http.server` lets the browser cache ES modules, so a pull can leave a tab running
old code. no-cache makes every reload revalidate. Stdlib only.
"""
import functools, http.server, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128  # the city and terrain loads open many requests at once
    daemon_threads = True


if __name__ == "__main__":
    print("Procella on http://localhost:8000/app/  (Ctrl+C stops)")
    Server(("127.0.0.1", 8000), functools.partial(NoCache, directory=str(ROOT))).serve_forever()
