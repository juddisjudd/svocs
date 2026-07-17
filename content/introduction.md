## What is SVOCS

SVOCS is a markdown-first documentation site generator built on SvelteKit and Svelte 5. Write plain Markdown, drop in live Svelte components exactly where you need them, and ship a fully static site with almost no client-side JavaScript.

## Why SVOCS

- `.md` files are plain prose; switch one to `.svx` and it can import and render real Svelte components inline.
- `content/` maps directly to `/docs/*` — no route config to maintain.
- Every build indexes your docs with Pagefind. Search runs in the browser, no server or API keys involved.
- Every page prerenders via `adapter-static`, and the Svelte compiler moves work to build time, so readers download very little JavaScript.
- Sidebar state, theme, and search all run on Svelte 5 runes, not legacy stores.

## How the pieces fit together

```txt
content/            Your markdown source
  _meta.json        Sidebar ordering, titles, and category labels
  getting-started.md
src/lib/core/       Content pipeline: parsing, page-map, metadata
src/lib/themes/docs/ The docs theme: sidebar, search, TOC
```

`_meta.json` is the file worth understanding first: it controls how your sidebar looks, independent of your file names. The [Navigation](/docs/navigation) guide covers it in full, including how to group pages under non-clickable category labels like the ones in this sidebar.

## Next steps

Head to [Quick Start](/docs/getting-started) to scaffold your first page, or jump straight to [Navigation](/docs/navigation) if you already have content and just want to organize it.
