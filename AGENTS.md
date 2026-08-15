# Repository operating contract

This repository is the single source of truth for `https://dxh.ink`.

## Normal article publication

- Edit only the selected file under `source/_posts/` and its article-scoped assets.
- Put standalone interactive reports under `source/reports/<slug>/` and link them from a normal post.
- Preserve every published permalink in `contracts/routes.lock.json`; ordinary publishing may add routes but must not remove or rename existing routes.
- Run `npm ci` followed by `npm run check` before committing.
- Stage exact paths. Do not use broad staging when unrelated changes exist.

## Maintenance boundaries

- `public/` is generated and must never be committed.
- GitHub Actions is the only production deployer. Never run `hexo deploy`, force-push, or rewrite public history.
- Changes to dependencies, the theme, workflows, `_config.yml`, domain settings, contracts, or global assets are maintenance work and must be isolated from article changes.
- Keep `source/CNAME` equal to `dxh.ink`, `_config.yml` URL equal to `https://dxh.ink`, and the site root equal to `/`.
- Do not delete old content, routes, or assets without explicit approval and a rollback plan.
- Never publish credentials, private links, local absolute paths, hidden prompts, or scratch files.

## Required verification

- `npm run check` validates content, builds the site, preserves locked routes, and hashes critical assets.
- After deployment, run `npm run verify:live` and confirm the deployment corresponds to the intended commit.
- A successful build or workflow alone is not proof of publication; verify the canonical `dxh.ink` URLs.
