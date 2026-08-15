# dxh.ink

This is the canonical source repository for [dxh.ink](https://dxh.ink). It contains the Hexo source, articles, vendored theme, validation contracts, and GitHub Pages workflow. Generated files under `public/` are deployment artifacts and are not committed.

## Local development

The exact Node and npm versions are pinned in `.node-version` and `package.json`.

```sh
npm ci
npm run check
npm run preview
```

The preview server is available at `http://localhost:4000/` by default.

## Publishing

1. Add or update the selected Markdown file under `source/_posts/`.
2. Add article-specific assets only when required.
3. Run `npm run check`.
4. Open a pull request. Merging to `master` builds and deploys the `public/` artifact through GitHub Actions.
5. Verify the public page with `npm run verify:live`.

Repository safety and scope rules are defined in `AGENTS.md`; architecture and recovery procedures are documented under `docs/`.
