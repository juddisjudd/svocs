## The problem

Scaffolding a new SVOCS site gets you generic starter pages — a "Quick Start," a "Writing Content" guide — that you're expected to replace by hand. If you already have a real project with a README, `create-svocs-docs` can generate a baseline `content/` tree from that repo instead, so you're editing real pages from the start rather than deleting placeholders.

## Two modes

**Heuristic** (default, no AI, no key needed) — fetches the repo's README and splits it along its own `##` headings. Each section becomes a page; whatever comes before the first heading becomes the introduction. Fast, free, and faithful to however the repo's own README is already organized.

**LLM-powered** (bring your own key — Anthropic or OpenAI) — sends the README and `package.json` to a model and asks for a proper set of docs pages back: an overview plus whichever topics the README actually implies (installation, usage, configuration...), synthesized rather than mechanically split. Better output, at the cost of a real API call.

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
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=llm --llm-provider=anthropic --llm-model=claude-opus-4-8 --scan-depth=deep
```

The LLM key comes from `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` in this non-interactive path — it's never prompted for and never read from an env var when you're answering prompts interactively, to keep the "typed once, nothing ambient" behavior simple.

## Key validation

Before spending a real analysis call, the key gets checked with a models-list request — free on both providers, since it costs no tokens. Success shows `API key validated ✓`; a bad key shows `API key invalid ✗` and falls back to heuristic immediately, rather than failing only after the "asking the AI" step. `--llm-model=`/`--scan-depth=` skip validation the same way flags skip every other prompt — non-interactive runs still validate the key itself, just without asking anything.

## Model and scan depth

Once the key validates, you pick a **model** — a couple of sensible defaults per provider (Haiku/Sonnet/Opus for Anthropic, GPT-4o mini/GPT-4o for OpenAI), plus a "Custom model ID…" option for anything newer than this CLI's curated list. `--llm-model=<id>` sets it non-interactively.

Then a **scan depth**, which changes both the page budget and how much of the repo gets fetched:

| Depth                   | Pages   | Extra fetched                 |
| ----------------------- | ------- | ----------------------------- |
| Quick Scan              | 1 to 3  | —                             |
| Standard Scan (default) | 1 to 8  | —                             |
| Deep Scan               | 1 to 12 | file tree + `CONTRIBUTING.md` |

Deep Scan's extra fetches go through the same unauthenticated GitHub REST API as the README/`package.json` fetch — no GitHub token needed, and no LLM-side web search or tool use involved. The file tree is paths only (build artifacts and lockfiles filtered out, capped at 300 entries), used to let the model infer topics the README doesn't spell out — a `cli/` directory implies a CLI reference page is worth writing — not to read every file's contents. `--scan-depth=<quick|standard|deep>` sets it non-interactively (defaults to `standard`).

## What gets replaced

Generated pages replace **all** of the starter content — introduction, quick start, writing content, components, AI & LLMs, theming, navigation, search, deployment, about — with whatever the analysis produced, so a repo-analysis scaffold ends up entirely about the repo you pointed it at rather than a mix of your content and generic SVOCS reference pages.

## It never blocks the scaffold

Every failure mode — repo not found, GitHub rate limit, no README, a rejected key, a malformed AI response — degrades one tier instead of stopping the CLI: LLM-powered falls back to heuristic, heuristic falls back to leaving the normal starter content in place untouched. Relative links and images in the source README (`[LICENSE](LICENSE)`) are rewritten to absolute GitHub URLs rather than left pointing at paths that don't exist on the new site.

## Reference

- `packages/create-svocs-docs/lib/repo-analysis.mjs` — fetch, generation, and validation logic
- `--repo=`, `--repo-mode=`, `--llm-provider=`, `--llm-model=`, `--scan-depth=` CLI flags
