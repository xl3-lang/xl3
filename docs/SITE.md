# Docs site (VitePress)

The xl3 docs site is a VitePress scaffold under `docs/`. It surfaces
the same markdown that already lives in the repo (cookbook, spec,
porter's guide, conformance dashboard, etc.) — no content duplication.

## Run locally

```bash
npm install            # one-time, picks up VitePress
npm run docs:dev       # http://localhost:5173
npm run docs:build     # static site → docs/.vitepress/dist/
npm run docs:preview   # serve the built site
```

## Source layout

- `docs/.vitepress/config.ts` — nav, sidebar, theme, markdown-it
  curly-brace escape (so XTL's literal `{{ ... }}` doesn't get parsed
  as Vue interpolation).
- `index.md` (repo root) — landing page (home layout).
- Everything else is pulled in from existing markdown trees:
  `spec/`, `docs/cookbook/`, `conformance/`, plus root-level docs
  (`README`, `PORTERS_GUIDE`, `IMPLEMENTATIONS`).

## Deploy

The site builds to `docs/.vitepress/dist/`. To host:

- **GitHub Pages.** Add a workflow that runs `npm run docs:build` and
  publishes the `dist/` directory.
- **Cloudflare Pages / Netlify / Vercel.** Set build command to
  `npm run docs:build`, output to `docs/.vitepress/dist`.
- **Static host (S3, R2, etc.).** Upload the `dist/` directory.

The repo's homepage URL is already `https://xl3.io`. Wire deployment
to that domain when ready.

## What's intentionally excluded

`CHANGELOG.md`, `spec/decisions/**/*.md` (ADRs), and
`docs/announcements/` are excluded from the site build. They contain
unconstrained `{{ ... }}` example text that would otherwise require
extensive escaping, and they read better on GitHub anyway (commit
history, line links).

## Adding a page

1. Drop a markdown file into the appropriate tree (e.g.,
   `docs/cookbook/11-new-recipe.md`).
2. Add a sidebar entry in `docs/.vitepress/config.ts`.
3. Run `npm run docs:dev` to preview.

XTL template syntax (`{{ ... }}`) is automatically escaped at render
time — no need for `<v-pre>` wrappers in normal cookbook prose.
