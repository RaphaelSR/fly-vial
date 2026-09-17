#!/usr/bin/env python3
"""Static server for development, with caching switched off.

Plain http.server lets the browser cache ES modules and the packed connectome,
so an edit can silently not take effect — and a stale meta.json against a fresh
conn.bin fails in a confusing way (an edge-count mismatch). Not for production;
GitHub Pages serves web/ directly.
"""
import http.server, socketserver, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')


class NoCache(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        if '404' in (args[1] if len(args) > 1 else ''):
            return
        super().log_message(fmt, *args)


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PORT), NoCache) as httpd:
    print(f"serving {os.path.realpath(ROOT)} at http://127.0.0.1:{PORT}  (no-cache)")
    httpd.serve_forever()
