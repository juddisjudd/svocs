## Setup

```sh
bun add flexsearch
```

```sh
PUBLIC_SVOCS_SEARCH_PROVIDER=flexsearch bun run build
```

Same static-only shape as Orama with a different index library; there's no server or sync step to run.

## How it works

A prerendered route, `/search-index.flexsearch.json`, serves FlexSearch's exported index chunks. FlexSearch's `export()` is callback-based and multi-chunk (one call per internal data structure), so every `{key, data}` pair gets collected into one JSON object rather than a single blob. The `⌘K` dialog fetches that once and calls `import(key, data)` for each entry to rebuild the index client-side, then searches the title, heading and body fields with `enrich: true` to get full records back instead of bare ids. FlexSearch has no field boosts, so title hits rank first, then heading hits, then body hits.

## A shared config, on purpose

`src/lib/search/providers/flexsearch-config.ts` holds one `Document` config, imported by both the indexer and the client. FlexSearch's exported chunks only re-import correctly against a `Document` instance built from an identical config to the one that exported them; two separately written configs would drift silently.

## Reference

- Shared config: `src/lib/search/providers/flexsearch-config.ts`
- Indexer: `src/lib/search/providers/flexsearch-indexer.ts`
- Route: `src/routes/search-index.flexsearch.json/+server.ts`
- Client: `src/lib/search/providers/flexsearch-client.ts`
