## Static output

SVOCS builds to plain static files, so it deploys anywhere that can serve HTML. Running the build produces a self-contained `build/` directory that already includes the Pagefind search index:

```sh
bun run build
# → vite build && pagefind --site build
```

Preview the exact output locally before shipping it:

```sh
bun run preview
```

## What the build contains

- Prerendered HTML for every docs page and the landing page
- Hashed JS/CSS assets with immutable cache headers ready
- `pagefind/` — the full-text search index, generated at build time
- Everything from `static/` copied verbatim (including `.nojekyll`)

## Host requirements

There are none beyond static file serving — no Node server, no functions, no environment variables at runtime. The two guides in this section walk through concrete setups:

- [Cloudflare Pages](/docs/deployment/cloudflare-pages) — zero-config, great default choice
- [GitHub Pages](/docs/deployment/github-pages) — free hosting straight from your repository

> Deploying under a sub-path (like `https://user.github.io/my-repo/`)? Set the `BASE_PATH` environment variable at build time. The GitHub Pages guide covers this.
