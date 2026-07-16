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

Answer the prompts (site name, accent color, whether to analyze an existing GitHub repo, search backend, whether to `git init`), then:

```sh
cd my-docs
bun install
bun run dev
```

Pass `--search=<backend>` to skip the search-backend prompt (`pagefind` (default), `orama`, `flexsearch`, `typesense`, or `chroma`), or `--accent=<hex>` to skip the accent-color prompt (e.g. `--accent=#2563eb`) — useful for scripted/non-interactive setups.

### Optional: generate content from an existing repo

Instead of the generic starter pages, you can point the CLI at an existing GitHub repo and it'll generate a baseline `content/` tree from that repo's README:

- **Heuristic** (default) — no AI, no key needed. Splits the README into pages along its own `##` headings.
- **LLM-powered** — bring your own Anthropic or OpenAI API key (typed once at the prompt, or via the `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` env var in non-interactive use; never written to disk). The key is checked against the provider (a models-list request — no tokens spent) before anything else happens, so a bad key fails fast with "API key invalid ✗" instead of surfacing only after the real analysis call. Once validated, you pick a model (a couple of sensible defaults per provider, plus a "Custom model ID…" option for anything newer) and a scan depth:
  - **Quick Scan** — 1 to 3 pages, README only.
  - **Standard Scan** (default) — 1 to 8 pages, README only.
  - **Deep Scan** — 1 to 12 pages; also pulls the repo's file tree and `CONTRIBUTING.md` (same unauthenticated GitHub API as everything else here — no extra token needed) so the model can infer topics the README doesn't spell out.

  The model rewrites the README (and, for Deep Scan, that extra context) into proper docs pages instead of just splitting it.

Either way, generation is a strict enhancement: any failure (repo not found, rate limited, bad key, malformed AI output) falls back a tier and the scaffold always finishes with the normal starter content if analysis doesn't pan out.

Non-interactive/scripted equivalent:

```sh
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=heuristic
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=llm --llm-provider=anthropic
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=llm --llm-provider=anthropic --llm-model=claude-opus-4-8 --scan-depth=deep
```

`--llm-model=<id>` skips the model prompt (any provider-valid model ID, not just the curated defaults). `--scan-depth=<quick|standard|deep>` skips the scan-depth prompt (defaults to `standard`).

## What you get

- A working SvelteKit + Svelte 5 site with the SVOCS content pipeline, sidebar, search (Pagefind by default — pick Orama, FlexSearch, Typesense, or Chroma during setup instead), and TOC scroll-spy already wired up.
- A `content/` tree demonstrating the category/separator `_meta.json` feature: Getting Started, Guides, Configuration, More — or, if you opted into repo analysis, a baseline tree generated from that repo instead.
- The full built-in `.svx` component library (Callout, Tabs, Steps, Cards, Collapse, Bleed, Banner, FileTree, ImageZoom).
- Dark/light theming, `BASE_PATH` support for sub-path deploys (e.g. GitHub Pages), and lint/format tooling.

No analytics, no telemetry. The only network calls this makes are the ones you opt into: fetching a GitHub repo's README/package.json if you ask for repo analysis (plus its file tree and `CONTRIBUTING.md` for Deep Scan — still no GitHub token, same public API), and calls to Anthropic or OpenAI if you additionally choose LLM-powered analysis (one to validate the key, one to run the analysis).
