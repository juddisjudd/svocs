## Add a page

Every file under `content/` becomes a route. Drop a markdown file at `content/hello.md`:

```md filename="content/hello.md"
---
title: Hello
description: My first page.
---

Hello from SVOCS.
```

Save it, and `/docs/hello` appears — no route file, no manual registration. The sidebar picks it up automatically, sorted alongside your other pages.

## Control the sidebar

Ordering and labels come from the `_meta.json` file next to the pages it applies to:

```json filename="content/_meta.json"
{
	"items": {
		"hello": { "title": "Hello, World", "order": 1 }
	}
}
```

`_meta.json` is also how you group pages under category headings, like "Getting Started" and "Guides" in this sidebar — see [Navigation](/docs/navigation) for the full schema.

## Run the dev server

```sh filename="bun"
bun run dev
```

```sh filename="npm"
npm run dev
```

```sh filename="pnpm"
pnpm dev
```

```sh filename="deno"
deno task dev
```

## Build for production

```sh
bun run build
```

This prerenders every page with `adapter-static` and indexes the site with Pagefind, so `bun run preview` serves the exact static output you'll deploy. See [Deployment](/docs/deployment) for hosting notes.

## Next steps

- [Writing Content](/docs/writing-content) — frontmatter, sidecar metadata, GFM, code blocks
- [Components](/docs/components) — the built-in `.svx` component library
- [Theming](/docs/theming) — change the accent color, or the rest of the palette
- [Navigation](/docs/navigation) — the full `_meta.json` schema
