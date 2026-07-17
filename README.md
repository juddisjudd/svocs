<p align="center">
  <a href="https://svocs.dev">
    <img src="static/1200x630-OG.png" alt="SVOCS — Svelte-powered documentation framework" width="100%" />
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/create-svocs-docs"><img src="https://img.shields.io/npm/v/create-svocs-docs?label=create-svocs-docs&color=ff3c00" alt="create-svocs-docs on npm" /></a>
  <a href="https://www.npmjs.com/package/svocs-cli"><img src="https://img.shields.io/npm/v/svocs-cli?label=svocs-cli&color=ff3c00" alt="svocs-cli on npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

# SVOCS

SVOCS is a markdown-first documentation site generator built on SvelteKit and Svelte 5. Write markdown in `content/`, drop in Svelte components where you need them, and ship a fully static site. No server required.

**Docs and live demo: [svocs.dev](https://svocs.dev)** (the site is built with SVOCS itself).

## Quick start

```sh
bunx create-svocs-docs@latest my-docs
# or: pnpm create svocs-docs my-docs
# or: npm create svocs-docs@latest my-docs
# or: deno run -A npm:create-svocs-docs my-docs
cd my-docs && bun install && bun run dev
```

The scaffolder asks for your site name, production URL, repository link, accent color, search backend, and deploy target. It can also [generate baseline content from an existing GitHub repo](https://svocs.dev/docs/repo-analysis), heuristically for free or with an LLM using your own API key.

## Features

- **Markdown-first content** — every file under `content/` becomes a route; `.svx` files mix Svelte components into markdown via [mdsvex](https://mdsvex.pngwn.io/)
- **Built-in component library** — Callout, Tabs, Steps, Cards (with an auto-populating mode for section landing pages), Collapse, Bleed, Banner, FileTree, ImageZoom
- **Page icons** — a curated hand-drawn icon set, set per page or per section, shown in the sidebar and page title
- **Search, five ways** — [Pagefind](https://pagefind.app/) by default (zero config, no server), or [Orama](https://orama.com/), [FlexSearch](https://github.com/nextapps-de/flexsearch), [Typesense](https://typesense.org/), [Chroma](https://www.trychroma.com/), all behind one ⌘K dialog
- **Social preview cards** — a 1200×630 OG image per page, rendered at build time by [Takumi](https://takumi.kane.tw/) with no headless browser
- **Math and diagrams** — LaTeX via [KaTeX](https://katex.org/), diagrams via [Mermaid](https://mermaid.js.org/)
- **AI-ready output** — `llms.txt` and `llms-full.txt` endpoints, plus a sitemap
- **Theming** — one accent color drives the whole palette (dark and light), with a View Transitions dissolve on theme switch
- **Site maintenance** — `npx svocs-cli doctor` checks configuration; `npx svocs-cli update` applies template fixes to files you haven't modified
- **Migration** — `npx svocs-cli migrate` converts an existing [Fumadocs](https://fumadocs.dev/), [Nextra](https://nextra.site/), [Docusaurus](https://docusaurus.io/), [Starlight](https://starlight.astro.build/), [MkDocs](https://www.mkdocs.org/), or [mdBook](https://rust-lang.github.io/mdBook/) site, mapping components and flagging what needs a human — these are all tools we respect, svocs is just one more option
- **Static output** — deploys to Cloudflare Pages, GitHub Pages, or any static host; `BASE_PATH` support for sub-path hosting

## Packages

| Package                                           | Description                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| [`create-svocs-docs`](packages/create-svocs-docs) | Scaffold a new SVOCS site (`bun create svocs-docs`)                   |
| [`svocs-cli`](packages/svocs-cli)                 | Companion CLI: `doctor`, `update`, and `migrate` for scaffolded sites |

This repository is also the source of [svocs.dev](https://svocs.dev) itself — `content/`, `src/`, and `scripts/` at the root are the documentation site.

## Developing

```sh
bun install
bun run dev          # dev server at localhost:5173
bun run check        # svelte-check
bun run lint         # prettier + eslint
bun run test:unit    # vitest
bun run build        # static build into build/, incl. search index + OG cards
bun run preview
```

Bun is the primary package manager; pnpm (`pnpm <script>`) and Deno (`deno task <task>`, see [deno.json](deno.json)) are also supported.

Known quirk: mdsvex emits Svelte 5 deprecation warnings for `context="module"` in generated markdown modules. They don't block builds.

## Deployment

The build output in `build/` is fully static. Step-by-step guides: [Cloudflare Pages](https://svocs.dev/docs/deployment/cloudflare-pages) and [GitHub Pages](https://svocs.dev/docs/deployment/github-pages). For sub-path hosts such as GitHub Pages project sites:

```sh
BASE_PATH=/my-repo bun run build
```

## Acknowledgements

SVOCS leans on a lot of open-source work:

- [Svelte & SvelteKit](https://svelte.dev/) — the framework underneath everything
- [Takumi](https://takumi.kane.tw/) by [Kane](https://github.com/kane50613) — the Rust renderer behind our OG cards; it's the reason builds don't need headless Chromium
- [mdsvex](https://mdsvex.pngwn.io/) — markdown preprocessing with Svelte components
- [Pagefind](https://pagefind.app/), [Orama](https://orama.com/), [FlexSearch](https://github.com/nextapps-de/flexsearch), [Typesense](https://typesense.org/), and [Chroma](https://www.trychroma.com/) — the search backends
- [KaTeX](https://katex.org/) and [Mermaid](https://mermaid.js.org/) — math and diagram rendering
- [Clack](https://github.com/bombshell-dev/clack) — the scaffolder's interactive prompts
- [Satoshi](https://www.fontshare.com/fonts/satoshi) by the Indian Type Foundry — the typeface, self-hosted via Fontshare's free license

## License

[MIT](LICENSE)
