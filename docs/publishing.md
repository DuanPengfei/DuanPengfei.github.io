# Publishing and recovery

## Normal publication

1. Start from the latest default branch.
2. Modify only the selected article and its scoped assets.
3. Run `npm ci` and `npm run check`.
4. Commit exact paths and open a pull request.
5. Merge only after CI succeeds. The Pages workflow deploys the generated artifact.
6. Run `npm run verify:live` and inspect the intended article.

## Recovery

- Revert a bad source change with an ordinary Git revert and let Actions rebuild it.
- For a Pages cutover incident, select the `archive/pages-legacy-20260815` branch root as the temporary branch publishing source.
- Do not reset, force-push, or edit generated production HTML by hand.
- The custom domain is controlled by GitHub Pages settings. `source/CNAME` records intent and supports local/legacy builds but is not proof that the domain setting is active.
