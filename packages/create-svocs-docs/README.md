# create-svocs-docs

Scaffold a new [SVOCS](https://github.com/juddisjudd/svocs) documentation site.

```sh
bunx create-svocs-docs my-docs
```

```sh
npm create svocs-docs@latest my-docs
```

```sh
pnpm create svocs-docs my-docs
```

```sh
deno run -A npm:create-svocs-docs my-docs
```

Answer the prompts (site name, search backend, whether to `git init`), then:

```sh
cd my-docs
bun install
bun run dev
```

Pass `--search=<backend>` to skip the search-backend prompt (`pagefind` (default), `orama`, `flexsearch`, `typesense`, or `chroma`) — useful for scripted/non-interactive setups.

## What you get

- A working SvelteKit + Svelte 5 site with the SVOCS content pipeline, sidebar, search (Pagefind by default — pick Orama, FlexSearch, Typesense, or Chroma during setup instead), and TOC scroll-spy already wired up.
- A `content/` tree demonstrating the category/separator `_meta.json` feature: Getting Started, Guides, Configuration, More.
- The full built-in `.svx` component library (Callout, Tabs, Steps, Cards, Collapse, Bleed, Banner, FileTree, ImageZoom).
- Dark/light theming, `BASE_PATH` support for sub-path deploys (e.g. GitHub Pages), and lint/format tooling.

No analytics, no telemetry, no network calls beyond the prompts you answer.
