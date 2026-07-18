# create-svocs-docs

Scaffold a new [SVOCS](https://github.com/juddisjudd/svocs) documentation site.

```sh
bunx create-svocs-docs@latest my-docs
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

Answer the prompts (site name, production URL, repository link, accent color, search backend, deploy target, whether to analyze an existing GitHub repo, whether to `git init`), then:

```sh
cd my-docs
bun install
bun run dev
```

The **production URL** prompt is worth answering if you know your domain: it sets `SITE_URL` in `src/lib/site.ts`, which turns on social-preview (`og:image`) tags, the sitemap, and absolute `llms.txt` links, and writes the `Sitemap:` line into `robots.txt`. Skipping it is fine — those features stay off until you set `SITE_URL` yourself. The **repository URL** prompt adds a GitHub button to the site header and an "Edit on GitHub" link on every doc page (it defaults to the repo you pointed the analysis at, if any), and picking **GitHub Pages** as the deploy target prints the `BASE_PATH` setup a project site needs.

Flags for scripted/non-interactive setups: `--search=<backend>` (`pagefind` (default), `orama`, `flexsearch`, `typesense`, or `chroma`), `--accent=<hex>` (e.g. `--accent=#2563eb`), `--site-url=<origin>` (e.g. `--site-url=https://docs.example.com`), `--repo-url=<owner/repo or URL>` (e.g. `--repo-url=juddisjudd/svocs`), and `--repo-branch=<name>` (defaults to `main`; only matters if your default branch is something else — it feeds the "Edit on GitHub" links, not the repo button).

The scaffold also writes a `.svocs.json` manifest recording the template version, your choices, and a hash of every generated file. The [`svocs-cli`](https://github.com/juddisjudd/svocs/tree/main/packages/svocs-cli) companion CLI uses it: `npx svocs-cli doctor` checks a site for common configuration problems, and `npx svocs-cli update` applies newer-template fixes to files you haven't modified.

### Optional: generate content from an existing repo

Instead of the generic starter pages, you can point the CLI at an existing GitHub repo and it'll generate a baseline `content/` tree from that repo's README:

- **Heuristic** (default) — splits the README into pages along its own `##` headings. No API key needed.
- **LLM-powered** — bring your own Anthropic, OpenAI, or OpenRouter API key (typed once at the prompt, or via the `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`OPENROUTER_API_KEY` env var in non-interactive use; never written to disk). OpenRouter routes to whichever backend a model actually runs on, so it's the option if you want a model neither Anthropic nor OpenAI serves directly. The key is checked against the provider before anything else happens (no tokens spent), so a bad key fails fast with "API key invalid ✗" instead of surfacing only after the real analysis call. Once validated, you pick a **model**, fetched live from the provider rather than hardcoded, since providers ship new models faster than a static list can track. Anthropic/OpenAI need the key to list models (OpenAI's raw list is filtered down to chat-capable ones); OpenRouter's public catalog is 300+ models across every backend it routes to, so it's a type-to-search list. A "Custom model ID…" option covers anything the list doesn't surface, and a small offline fallback set is used if the live fetch fails. Then a **scan depth**:
  - **Quick Scan** — 1 to 3 pages, README only.
  - **Standard Scan** (default) — 1 to 8 pages, README only.
  - **Deep Scan** — 1 to 12 pages; also pulls the repo's file tree and `CONTRIBUTING.md` (same unauthenticated GitHub API as everything else here, no extra token needed) so the model can infer topics the README doesn't spell out.

  The model rewrites the README (and, for Deep Scan, that extra context) into proper docs pages instead of just splitting it. There's no timeout on the analysis call: Deep Scan can ask for up to 8192 output tokens, which pairs with whatever model you picked, so the request runs until it finishes or errors on its own. Ctrl+C cancels it like any other prompt.

Either way, generation is a strict enhancement: any failure (repo not found, rate limited, bad key, malformed AI output) falls back a tier and the scaffold always finishes with the normal starter content if analysis doesn't pan out.

Non-interactive/scripted equivalent:

```sh
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=heuristic
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=llm --llm-provider=anthropic
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=llm --llm-provider=openrouter --llm-model=anthropic/claude-sonnet-5 --scan-depth=deep
```

`--llm-provider=<anthropic|openai|openrouter>` skips the provider prompt. `--llm-model=<id>` skips the model prompt (any provider-valid model ID; for OpenRouter that's a `provider/model` slug, not the same string you'd pass to that provider's own native API). `--scan-depth=<quick|standard|deep>` skips the scan-depth prompt (defaults to `standard`).

## What you get

- A working SvelteKit + Svelte 5 site with the SVOCS content pipeline, sidebar, search (Pagefind by default; pick Orama, FlexSearch, Typesense, or Chroma during setup instead), and TOC scroll-spy already wired up.
- A `content/` tree demonstrating the category/separator `_meta.json` feature: Getting Started, Guides, Configuration, More. If you opted into repo analysis, you get a baseline tree generated from that repo instead.
- The full built-in `.svx` component library (Callout, Tabs, Steps, Cards, Collapse, Bleed, Banner, FileTree, ImageZoom).
- Dark/light theming, `BASE_PATH` support for sub-path deploys (e.g. GitHub Pages), and lint/format tooling.

The CLI collects no analytics or telemetry. The only network calls it makes are the ones you opt into: fetching a GitHub repo's README/package.json if you ask for repo analysis (plus its file tree and `CONTRIBUTING.md` for Deep Scan, via the same public API with no token), and calls to Anthropic, OpenAI, or OpenRouter if you additionally choose LLM-powered analysis (one to validate the key, one to list available models, one to run the analysis).
