## The problem

An LLM (or an agent, or a tool like Cursor) reading your docs by scraping rendered HTML gets your sidebar markup, your ⌘K dialog's DOM, and your footer: noise around the actual content. SVOCS exposes the same content two other ways, built at the same time as the HTML, with no extra config.

## `llms.txt`

A single page listing every doc, grouped by the same categories as your sidebar, each linking to its markdown source:

```txt
# SVOCS

> Markdown-first documentation site generator built on SvelteKit and Svelte 5.

## Getting Started
- [Introduction](https://svocs.dev/docs/introduction.md): What SVOCS is, why it exists...
- [Quick Start](https://svocs.dev/docs/getting-started.md): Scaffold a project...
```

Live at [`/llms.txt`](/llms.txt). This follows the [llms.txt convention](https://llmstxt.org): an index an AI tool can fetch once to learn what your site has and where.

## `llms-full.txt`

Every page's full markdown source, concatenated and separated by `---`. A single fetch returns the whole site, so nothing has to crawl it. Live at [`/llms-full.txt`](/llms-full.txt).

## Raw markdown per page

Every doc page is also available with a `.md` suffix: `/docs/introduction` renders the HTML page, while `/docs/introduction.md` returns the same content as plain markdown, headings and code fences intact, with `Content-Type: text/markdown`. The **Copy Markdown** and **View as Markdown** buttons under each page title are wired to this.

## How it's built

All three reuse one function, `getAllLlmsDocuments()` in `src/lib/core/content.ts`, which returns the _unstripped_ markdown source per page. It's deliberately kept separate from the search system's `getAllSearchDocuments()`, which strips markup for tokenization; an AI consumer wants the real source, not stripped plain text. `llms.txt`'s category grouping walks the same page-map tree the sidebar renders from, so it never drifts out of sync with your actual navigation.

None of this needs configuration. It's on by default for every SVOCS site.
