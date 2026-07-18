## Scaffold a project

The fastest way to start is the `create-svocs-docs` starter, which sets up a working SVOCS site with the same page structure as this one:

```sh filename="bun"
bunx create-svocs-docs@latest my-docs
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

```sh filename="nub"
nubx create-svocs-docs@latest my-docs
```

Answer the prompts, then start the dev server:

```sh
cd my-docs
bun install
bun run dev
```

Your new site is live at `http://localhost:5173`.

The prompts also let you set your production URL (which turns on [social preview cards](/docs/og-images), the sitemap, and absolute `llms.txt` links), add a GitHub button to the header, pick an accent color and a search backend, and, optionally, generate baseline content from an existing GitHub repo instead of the generic starter pages. See [Theming](/docs/theming) and [Repo Analysis](/docs/repo-analysis).

## Keep your site current

Scaffolds record a `.svocs.json` manifest, and the `svocs` companion CLI uses it to maintain your site after day one:

```sh
npx svocs-cli doctor   # checks SITE_URL, fonts, search config, template version
npx svocs-cli update   # applies template fixes to files you haven't modified
```

`update` never touches a file you've edited — it lists those for manual review instead. Both commands are covered on the [CLI](/docs/cli) page.

## Add a page

Every file under `content/` becomes a route. Drop a markdown file at `content/hello.md`:

```md filename="content/hello.md"
---
title: Hello
description: My first SVOCS page.
---

Hello from SVOCS.
```

Save it, and `/docs/hello` appears without any route file or registration step. The sidebar picks it up automatically, sorted alongside your other pages.

## Control the sidebar

Ordering and labels come from a `_meta.json` file next to the pages it applies to:

```json filename="content/_meta.json"
{
	"items": {
		"hello": { "title": "Hello, World", "order": 1 }
	}
}
```

`_meta.json` is also how you group pages under category headings, like "Getting Started" and "Guides" in this sidebar. See [Navigation](/docs/navigation) for the full schema.

## Build for production

```sh
bun run build
```

This prerenders every page with `adapter-static` and indexes the site with Pagefind, so `bun run preview` serves the exact static output you'll deploy. See [Deployment](/docs/deployment) for Cloudflare Pages and GitHub Pages walkthroughs.

## Next steps

- [Writing Content](/docs/writing-content) — frontmatter, sidecar metadata, GFM, code blocks
- [Components](/docs/components) — the built-in `.svx` component library
- [Theming](/docs/theming) — change the accent color, or the rest of the palette
- [Navigation](/docs/navigation) — the full `_meta.json` schema
- [Repo Analysis](/docs/repo-analysis) — generate starter content from an existing repo, heuristically or with an AI
