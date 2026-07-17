## Authoring model

Use plain markdown (`.md`) for most pages, and switch to `.svx` only when a page needs a live Svelte component inline. Everything else about the two file types is identical: frontmatter, sidecars, GFM, code blocks.

## Frontmatter

Set page metadata directly in the file with YAML frontmatter; no sidecar file is required:

```md filename="content/example.md"
---
title: Example Page
description: Shown in listings and the meta description tag.
order: 5
tags: [guide]
---

Your content starts here.
```

## Metadata fields

- `title`: Display title
- `description`: Optional summary for listings
- `order`: Sorting number for nav
- `tags`: Optional list for future filtering

Pages also show a "Last updated on" date, taken from the file's most recent git commit at build time — not from filesystem timestamps, which reset on every fresh clone. There's nothing to set: commit the file and the date follows. If your CI does a shallow clone (GitHub Actions and Cloudflare default to one), most files have no reachable history and the date is simply omitted; fetch full history to get it back (`fetch-depth: 0` in the [GitHub Pages workflow](/docs/deployment/github-pages)).

## Sidecar overrides

A `name.meta.json` file next to `name.md` takes priority over frontmatter for any field it sets. That's useful when you want to tweak nav ordering without touching the prose file, or for content synced in from elsewhere:

```json filename="content/example.meta.json"
{
	"order": 1
}
```

Frontmatter still supplies everything the sidecar doesn't override. `_meta.json`, a separate folder-level file, sits above both; see [Navigation](/docs/navigation) for how that precedence works.

## Headings

Use consistent heading levels so TOC generation and anchor links are predictable.

## GFM formatting

Tables, task lists, strikethrough, and bare-URL autolinks all work out of the box:

| Feature       | Syntax         |
| ------------- | -------------- |
| Table         | pipe-delimited |
| Task list     | `- [ ] todo`   |
| Strikethrough | `~~done~~`     |

- [x] Ship GFM support
- [ ] Ship more of the roadmap

## Code blocks with a filename

Add `filename="..."` to a fence's info string to show a filename header above the code, alongside the built-in copy button every code block gets:

````md
```sh filename="deploy.sh"
echo hello
```
````

## Diagrams and math

Mermaid diagrams use a ` ```mermaid ` fence and render to inline SVG:

````md
```mermaid
graph LR
  A[content/*.md] --> B[mdsvex]
  B --> C[page]
```
````

Mermaid's layout engine needs a real browser, so instead of driving a headless Chromium at build time, the diagram renders in the reader's browser. The mermaid library loads lazily and only on pages that actually contain a diagram; every other page ships none of it, and builds need no browser anywhere — locally, in Docker, or in CI. Diagrams pick the dark or light theme active when the page loads.

LaTeX math uses `$inline$` and `$$block$$` syntax, rendered via KaTeX to static HTML at build time — no client-side JS ships for it:

```md
Inline: $E = mc^2$.

Block:

$$
t = \max\left(1, \left\lceil \frac{w}{200} \right\rceil\right)
$$
```

## Components

`.svx` files (not `.md`) can import and use Svelte components inline. See the [Components](/docs/components) page for the full built-in set (Callout, Tabs, Steps, Cards, Collapse, Bleed, Banner, FileTree, ImageZoom) and how to import them.

> **Watch out:** avoid writing a literal script-tag as inline code (single backticks). Unlike
> fenced code blocks, inline spans aren't protected from Svelte's own tag parsing and will break
> the build. Describe it in prose instead, or put it inside a fenced code block.
