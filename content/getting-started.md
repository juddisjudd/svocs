## Scaffold a project

The fastest way to start is the `create-svocs-docs` starter, which drops in a working SVOCS site with this exact page structure — sidebar, search, theming, and all:

```sh filename="bun"
bunx create-svocs-docs my-docs
```

```sh filename="npm"
npm create svocs-docs@latest my-docs
```

```sh filename="pnpm"
pnpm create svocs-docs my-docs
```

```sh filename="deno"
deno run -A npm:create-svocs-docs my-docs
```

Answer the prompts, then start the dev server:

```sh
cd my-docs
bun install
bun run dev
```

Your new site is live at `http://localhost:5173`.

## Add a page

Every file under `content/` becomes a route. Drop a markdown file at `content/hello.md`:

```md filename="content/hello.md"
---
title: Hello
description: My first SVOCS page.
---

Hello from SVOCS.
```

Save it, and `/docs/hello` appears — no route file, no manual registration. The sidebar picks it up automatically, sorted alongside your other pages.

## Control the sidebar

Ordering and labels come from a `_meta.json` file next to the pages it applies to:

```json filename="content/_meta.json"
{
	"items": {
		"hello": { "title": "Hello, World", "order": 1 }
	}
}
```

`_meta.json` is also how you group pages under category headings, like "Getting Started" and "Guides" in this sidebar — see [Navigation](/docs/navigation) for the full schema.

## Build for production

```sh
bun run build
```

This prerenders every page with `adapter-static` and indexes the site with Pagefind, so `bun run preview` serves the exact static output you'll deploy. See [Deployment](/docs/deployment) for Cloudflare Pages and GitHub Pages walkthroughs.

## Next steps

- [Writing Content](/docs/writing-content) — frontmatter, sidecar metadata, GFM, code blocks
- [Components](/docs/components) — the built-in `.svx` component library
- [Navigation](/docs/navigation) — the full `_meta.json` schema
