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

Picking LLM-powered adds one more prompt for the provider, then a masked key prompt — typed once, used for that single request, never written to disk.

For scripted use, skip the prompts entirely:

```sh
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=heuristic
bunx create-svocs-docs my-docs --repo=owner/repo --repo-mode=llm --llm-provider=anthropic
```

The LLM key comes from `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` in this non-interactive path — it's never prompted for and never read from an env var when you're answering prompts interactively, to keep the "typed once, nothing ambient" behavior simple.

## What gets replaced

Generated pages replace the whole **Getting Started** and **Guides** starter content — introduction, quick start, writing content, components, AI & LLMs — with whatever the analysis produced. **Configuration** and **More** (navigation, search, deployment, about) are untouched either way, since those document SVOCS itself rather than the repo you're analyzing.

## It never blocks the scaffold

Every failure mode — repo not found, GitHub rate limit, no README, a rejected key, a malformed AI response — degrades one tier instead of stopping the CLI: LLM-powered falls back to heuristic, heuristic falls back to leaving the normal starter content in place. Relative links and images in the source README (`[LICENSE](LICENSE)`) are rewritten to absolute GitHub URLs rather than left pointing at paths that don't exist on the new site.

## Reference

- `packages/create-svocs-docs/lib/repo-analysis.mjs` — fetch, generation, and validation logic
- `--repo=`, `--repo-mode=`, `--llm-provider=` CLI flags
