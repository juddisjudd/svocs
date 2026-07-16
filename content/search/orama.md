## Setup

```sh
bun add @orama/orama
```

```sh
PUBLIC_SVOCS_SEARCH_PROVIDER=orama bun run build
```

That's the whole configuration. Orama indexes in the browser, so there's no server or sync step to run.

## How it works

A prerendered route, `/search-index.orama.json`, serves every page's `{id, url, title, content}` as a plain JSON array. It's built during `vite build` itself, guarded so it 404s (and is skipped) on any other backend. The `⌘K` dialog fetches that JSON once, builds a fresh in-memory Orama index with `create()` + `insertMultiple()`, and searches locally from then on.

## Why build the index in the browser instead of shipping a pre-built one?

Orama does support serializing a pre-built database via `@orama/plugin-data-persistence`, but that plugin pulls in `dpack`, which depends on Node's `Transform` streams. Those are unavailable in the browser, and it breaks at runtime even when you only use the `'json'` format ([orama#876](https://github.com/oramasearch/orama/issues/876)). Shipping raw documents and indexing client-side sidesteps the dependency entirely, and re-indexing a few dozen docs in-browser is effectively free.

## Reference

- Indexer: `src/lib/search/providers/orama-indexer.ts`
- Route: `src/routes/search-index.orama.json/+server.ts`
- Client: `src/lib/search/providers/orama-client.ts`
