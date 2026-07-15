## Built in, no config

Every SVOCS site exposes its content two extra ways, generated at build time alongside the HTML:

- **`/llms.txt`** — every doc listed by category, each linking to its markdown source.
- **`/llms-full.txt`** — every page's full markdown, concatenated.
- **`/docs/page.md`** — any doc page's raw markdown (`/docs/introduction` renders HTML, `/docs/introduction.md` returns the same content as plain text). Every page has **Copy Markdown** / **View as Markdown** buttons under its title.

This is the emerging [llms.txt convention](https://llmstxt.org) — a way for AI tools to read your docs without scraping rendered HTML.

Set `SITE_URL` in `src/lib/site.ts` once you know your production domain, so the links in `llms.txt` are absolute rather than relative.
