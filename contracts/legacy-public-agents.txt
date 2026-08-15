# AGENTS.md

## Cursor Cloud specific instructions

This repository is a **static Hexo-generated blog** (`DuanPengfei.github.io`). It contains only pre-built HTML, CSS, JS, and image assets — there is no build step, no package manager, no `package.json`, and no dependencies to install.

### Running the site

Serve the static files with any HTTP server from the repository root:

```sh
python3 -m http.server 8080
```

The site will be available at `http://localhost:8080/`.

### Key notes

- **No lint, test, or build commands exist** — the repo has no tooling configuration.
- All JS/CSS libraries (jQuery, Bulma, MathJax, highlight.js, Font Awesome, lightGallery) are loaded from external CDNs, so internet access is required for full rendering.
- The `CNAME` file maps to the custom domain `dxh.ink` for GitHub Pages deployment; it is not relevant for local development.
