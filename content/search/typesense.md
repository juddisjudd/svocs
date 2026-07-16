## Setup

```sh
bun add typesense
```

You'll need a running Typesense server, either self-hosted (Coolify, Docker, anywhere) or Typesense Cloud.

## Environment variables

Sync-only; never expose these to the browser:

```txt
TYPESENSE_HOST=your-typesense-host
TYPESENSE_PORT=443
TYPESENSE_PROTOCOL=https
TYPESENSE_ADMIN_API_KEY=...
```

Client-safe: these ship to the browser, so `PUBLIC_TYPESENSE_SEARCH_API_KEY` must be a **search-only, collection-scoped** key, not the admin key above:

```txt
PUBLIC_SVOCS_SEARCH_PROVIDER=typesense
PUBLIC_TYPESENSE_HOST=your-typesense-host
PUBLIC_TYPESENSE_PORT=443
PUBLIC_TYPESENSE_PROTOCOL=https
PUBLIC_TYPESENSE_COLLECTION_NAME=svocs-docs
PUBLIC_TYPESENSE_SEARCH_API_KEY=...
```

Generate the scoped key once, manually, against your admin key. This isn't part of the automated sync:

```js
await client.keys().create({
	actions: ['documents:search'],
	collections: ['svocs-docs']
});
```

## Building

```sh
bun run build
```

`scripts/search/postbuild.mjs` runs `bun run scripts/search/sync-typesense.ts` automatically after the static build. It reads the already-prerendered `build/search-index.json`, recreates the collection, and imports every page with `action: 'upsert'`. A full recreate (not an incremental sync) is deliberate: it guarantees removed or renamed pages never leave stale entries behind.

## CORS

Set your Typesense server's CORS allowlist to your exact production origin (`https://svocs.dev`) plus your local dev origin (`http://localhost:5173`). Don't wildcard it: the search-only key is safe to expose, but only from origins you actually control.

## Reference

- Sync script: `scripts/search/sync-typesense.ts` (also runnable directly: `bun run search:sync:typesense`)
- Client: `src/lib/search/providers/typesense-client.ts`
