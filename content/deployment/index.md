## Static output

SVOCS builds to plain static files, so it deploys anywhere that can serve HTML. Running the build produces a self-contained `build/` directory that already includes your search index:

```sh
bun run build
# → vite build && node scripts/search/postbuild.mjs
```

The postbuild step dispatches to whichever search backend is active; see [Search](/docs/search) for the full list and how to switch.

Preview the exact output locally before shipping it:

```sh
bun run preview
```

## What the build contains

- Prerendered HTML for every docs page and the landing page
- Hashed JS/CSS assets with immutable cache headers ready
- Your search index (its shape depends on the active backend; see [Search](/docs/search))
- Everything from `static/` copied verbatim (including `.nojekyll`)

## Host requirements

There are none beyond serving static files. The output needs no Node server, no serverless functions, and no environment variables at runtime. The two guides in this section walk through concrete setups:

- [Cloudflare Pages](/docs/deployment/cloudflare-pages) — a good default; connects to your repo and needs no configuration
- [GitHub Pages](/docs/deployment/github-pages) — free hosting straight from your repository

> Deploying under a sub-path (like `https://user.github.io/my-repo/`)? Set the `BASE_PATH` environment variable at build time. The GitHub Pages guide covers this.
