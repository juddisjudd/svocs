## The default

Pagefind is what you get with no configuration at all: `PUBLIC_SVOCS_SEARCH_PROVIDER` unset, and nothing to install beyond what's already in `package.json`.

## How it works

`bun run build` does two things: `vite build` prerenders every page to static HTML, then `pagefind --site build` crawls that HTML and writes a WASM-powered search index into `build/pagefind/`. The `⌘K` dialog dynamically imports `pagefind/pagefind.js` on first use and queries it entirely client-side, so no server is involved.

## Testing it locally

Pagefind's index only exists after a build. `bun run dev` has nothing to query, so `⌘K` will 404 on `pagefind/pagefind.js` there by design. Run `bun run build` then `bun run preview` to test it against the real index.

## Why you might switch away from it

Pagefind indexes rendered HTML, so results are whatever text ends up on the page — including decorative UI text if you're not careful with `data-pagefind-ignore`. If you want cleaner excerpts sourced from frontmatter/sidecar `description` fields instead, see [Orama](/docs/search/orama) or [FlexSearch](/docs/search/flexsearch); if you want semantic ("how do I deploy this" matching a page that never says those words) search, see [Chroma](/docs/search/chroma).

## Reference

- Indexing: `pagefind --site build`, dispatched by `scripts/search/postbuild.mjs`
- Client: `src/lib/search/providers/pagefind-client.ts`
