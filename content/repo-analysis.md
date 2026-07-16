## The problem

Scaffolding a new SVOCS site gets you generic starter pages — a "Quick Start," a "Writing Content" guide — that you're expected to replace by hand. If you already have a real project with a README, `create-svocs-docs` can generate a baseline `content/` tree from that repo instead, so you're editing real pages from the start rather than deleting placeholders.

## Two modes

**Heuristic** (default, no AI, no key needed) — fetches the repo's README and splits it along its own `##` headings. Each section becomes a page; whatever comes before the first heading becomes the introduction. Fast, free, and faithful to however the repo's own README is already organized.

**LLM-powered** (bring your own key — Anthropic, OpenAI, or OpenRouter) — sends real repo material (the README plus, depending on scan depth, the repo's other markdown docs, root config files, or actual source files) to a model and asks for a proper set of docs pages back: an overview plus whichever topics that material actually supports (installation, usage, configuration...), synthesized rather than mechanically split. Better output, at the cost of real API calls. OpenRouter routes to whichever backend the model you pick actually runs on (Anthropic, Google, open-weight models, and more), so it's the option if you want a model neither Anthropic nor OpenAI serves directly.

## Using it

The CLI asks during scaffolding:

```txt
Analyze an existing GitHub repo for a baseline docs setup? (y/N) y
GitHub repo (owner/repo or URL): owner/repo

Analysis mode:
  1) Heuristic — reorganizes the README, no AI, no key needed (default)
  2) LLM-powered — an AI rewrites the content into docs pages (bring your own key)
```

Picking LLM-powered adds a provider prompt, then a masked key prompt — typed once, used for validation plus that single analysis request, never written to disk.

For scripted use, skip the prompts entirely:

```sh
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=heuristic
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=llm --llm-provider=anthropic
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=llm --llm-provider=openrouter --llm-model=anthropic/claude-sonnet-5 --scan-depth=deep
```

The LLM key comes from `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`OPENROUTER_API_KEY` in this non-interactive path — it's never prompted for and never read from an env var when you're answering prompts interactively, to keep the "typed once, nothing ambient" behavior simple.

## Key validation

Before spending a real analysis call, the key gets checked against the provider — free, since it costs no tokens (a models-list request for Anthropic/OpenAI; OpenRouter's models list is public regardless of key validity, so it uses its key-info endpoint instead). Success shows `API key validated ✓`; a bad key shows `API key invalid ✗` and falls back to heuristic immediately, rather than failing only after the "asking the AI" step. `--llm-model=`/`--scan-depth=` skip validation the same way flags skip every other prompt — non-interactive runs still validate the key itself, just without asking anything.

## Model and scan depth

Once the key validates, you pick a **model**. This list is fetched live from the provider you picked, not hardcoded — providers ship new models faster than a static list could ever track (this CLI's previous curated list was already missing models that existed by the time it shipped). Anthropic and OpenAI need the key to list models; OpenAI's raw list mixes in non-chat models (embeddings, Whisper, DALL-E, etc.), so it's filtered down to chat-capable ones. OpenRouter's catalog is public and large (300+ models across every backend it routes to), so its picker is a type-to-search list rather than a short menu. If fetching the list fails for any reason, a small offline fallback set is used instead. Either way there's also a "Custom model ID…" option for anything the list doesn't surface. `--llm-model=<id>` sets it non-interactively — for OpenRouter, model IDs are `provider/model` slugs (e.g. `anthropic/claude-sonnet-5`, `openai/gpt-5.4`), not the same string you'd pass to that provider's own native API.

Then a **scan depth**, which changes both the page budget and what repo material the model gets to write from:

| Depth                   | Pages   | Material beyond the README                                                            | How pages are generated                         |
| ----------------------- | ------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Quick Scan              | 1 to 3  | the repo's other `.md` docs (root + `docs/`, e.g. `CONTRIBUTING.md`, guides)          | one call returns every page                     |
| Standard Scan (default) | 1 to 8  | quick's material + root config/manifest files (`Dockerfile`, `pyproject.toml`, CI, …) | a plan call, then one call per page             |
| Deep Scan               | 1 to 12 | the entire repo, downloaded once as a tarball                                         | a plan call, then one call per page from source |

Quick and standard fetch their extra files through the same unauthenticated GitHub endpoints as the README/`package.json` fetch — no GitHub token needed, and no LLM-side web search or tool use involved. Deep Scan doesn't fetch file-by-file (the unauthenticated API allows only 60 requests/hour); it downloads the repo as a single archive, indexes every text file in it, and shows the model the real file tree. The plan call then names which source files each page should be written from — a `cli/` directory doesn't just imply a CLI reference page exists, the page gets written from the actual CLI source. If the archive download fails, Deep Scan degrades to standard-depth material and says so. `--scan-depth=<quick|standard|deep>` sets it non-interactively (defaults to `standard`).

Because standard and deep generate pages one at a time, a single malformed or truncated page response only skips that page (with a warning naming it) instead of discarding the whole analysis, and the spinner reports progress per page. There's no request timeout on the generation calls themselves — they pair with whatever model you picked, including the slowest one on any given provider. Rather than guess a cutoff that's wrong for some combination of scan depth and model, each request just runs until it finishes or errors on its own; Ctrl+C cancels at any point, same as any other prompt in this CLI.

## What gets replaced

Generated pages replace **all** of the starter content — introduction, quick start, writing content, components, AI & LLMs, theming, navigation, search, deployment, about — with whatever the analysis produced, so a repo-analysis scaffold ends up entirely about the repo you pointed it at rather than a mix of your content and generic SVOCS reference pages.

## It never blocks the scaffold

Every failure mode — repo not found, GitHub rate limit, no README, a rejected key, a failed archive download, a malformed AI response — degrades one tier instead of stopping the CLI: Deep Scan falls back to standard-depth material, LLM-powered falls back to heuristic, heuristic falls back to leaving the normal starter content in place untouched. Warnings now say _why_ an AI response was rejected (truncated at the token limit, unparseable JSON, a missing field) instead of a generic "not valid". Relative links and images in the source README (`[LICENSE](LICENSE)`) are rewritten to absolute GitHub URLs rather than left pointing at paths that don't exist on the new site.

## Reference

- `packages/create-svocs-docs/lib/repo-analysis.mjs` — fetch, generation, and validation logic
- `--repo=`, `--repo-mode=`, `--llm-provider=`, `--llm-model=`, `--scan-depth=` CLI flags
