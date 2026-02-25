#!/usr/bin/env python3
"""Smoke-test the static site with a temporary local HTTP server."""

from __future__ import annotations

import functools
import http.server
import threading
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]

# (path, expected_status, required_substrings)
CHECKS = [
    ("/", 200, ["Hexo", "navbar-main"]),
    ("/archives/", 200, ["Hexo", "/2020/"]),
    ("/about/", 200, ["Hexo", "github.com"]),
    ("/js/script.js", 200, ["navbar-burger", "hasScrolled"]),
    ("/content.json", 200, ['"posts"', '"pages"']),
]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Silence request logs during smoke tests."""

    def log_message(self, format: str, *args: object) -> None:
        return


def fetch(url: str) -> tuple[int, str]:
    with urllib.request.urlopen(url, timeout=5) as response:
        body = response.read().decode("utf-8", errors="ignore")
        return response.status, body


def main() -> None:
    handler = functools.partial(QuietHandler, directory=str(ROOT_DIR))
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        port = server.server_address[1]
        base_url = f"http://127.0.0.1:{port}"
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        print(f"Serving {ROOT_DIR} at {base_url}")

        try:
            for path, expected_status, substrings in CHECKS:
                url = f"{base_url}{path}"
                status, body = fetch(url)
                if status != expected_status:
                    raise AssertionError(
                        f"{path}: expected HTTP {expected_status}, got {status}"
                    )
                missing = [token for token in substrings if token not in body]
                if missing:
                    raise AssertionError(
                        f"{path}: missing expected content {missing}"
                    )
                print(f"[ok] GET {path:<14} -> {status} ({len(body)} bytes)")
        finally:
            server.shutdown()
            thread.join(timeout=5)

    print("Smoke test passed.")


if __name__ == "__main__":
    main()
