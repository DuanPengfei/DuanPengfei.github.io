# Static Site Development Setup

This repository contains a pre-generated static Hexo site (HTML/CSS/JS files).
No build step or package installation is required to run it locally.

## Prerequisites

- Python 3.8+ (for the built-in local HTTP server)

## Run locally

From the repository root:

```bash
python3 -m http.server 8000
```

Then open:

- http://127.0.0.1:8000/

## Smoke test

An automated smoke test is included to verify the local environment and core routes:

```bash
python3 scripts/smoke_test.py
```

The script starts a temporary local server, checks key pages/assets, then shuts
down automatically.
