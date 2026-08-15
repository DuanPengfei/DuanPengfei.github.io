# Architecture

`DuanPengfei.github.io` is the only active repository for the blog. The default branch stores source and policy; GitHub Actions builds an immutable `public/` artifact and deploys it to Pages.

```text
source/_posts + source assets + vendored theme
                    |
                    v
             npm run check
                    |
                    v
          public/ Pages artifact
                    |
                    v
             https://dxh.ink
```

The original generated-site history and the original `blog` source history are connected by a non-squashed merge commit. Recovery branches retain the exact pre-migration heads.

Hexo and the Minos theme remain unchanged during repository consolidation. Generator or visual redesign work must be reviewed and deployed independently so URL and rendering regressions are attributable.
