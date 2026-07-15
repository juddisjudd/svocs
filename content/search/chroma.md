## Setup

```sh
bun add chromadb
```

You'll need a running Chroma server — self-hosted (Coolify, Docker) is the common path.

## This is semantic search, not keyword search

Chroma is a vector database. Your query and every indexed page get turned into embeddings and matched by similarity, not exact text overlap — "how do I ship this" can match a page titled "Deployment" even though it never says "ship." The upside is genuinely better recall for natural-language questions; the trade-off is you're running a real service instead of a static index.

Chroma's server embeds everything for you — `collection.add({documents})` and `collection.query({queryTexts})` both take plain text. There's no separate embedding pipeline to build or an API key for an embedding provider to manage.

## Environment variables

Sync-only:

```txt
CHROMA_HOST=your-chroma-host
CHROMA_PORT=8000
CHROMA_SSL=true
CHROMA_ADMIN_TOKEN=...
PUBLIC_CHROMA_COLLECTION_NAME=svocs-docs
```

Client-safe:

```txt
PUBLIC_SVOCS_SEARCH_PROVIDER=chroma
PUBLIC_CHROMA_HOST=your-chroma-host
PUBLIC_CHROMA_PORT=8000
PUBLIC_CHROMA_SSL=true
PUBLIC_CHROMA_COLLECTION_NAME=svocs-docs
PUBLIC_CHROMA_TOKEN=...
```

> **Security — read this before deploying.** Unlike Typesense, Chroma has no turnkey "generate a read-only key" call. A genuinely query-only credential requires manually configuring token auth (`CHROMA_SERVER_AUTHN_PROVIDER=chromadb.auth.token_authn.TokenAuthenticationServerProvider`) _and_ role-based authorization (`CHROMA_SERVER_AUTHZ_PROVIDER=chromadb.auth.simple_rbac_authz.SimpleRBACAuthorizationProvider`) scoping `PUBLIC_CHROMA_TOKEN` to the `QUERY` action only, on your server — this project's code can't do that part for you. There is also a known unauthenticated remote-code-execution advisory against Chroma instances left without auth enabled ("ChromaToast"). Never expose a Chroma instance publicly without token auth and TLS already configured and verified.

## Building

```sh
bun run build
```

`scripts/search/postbuild.mjs` runs `bun run scripts/search/sync-chroma.ts` automatically — it reads `build/search-index.json`, deletes and recreates the collection (so removed/renamed pages never linger), and adds every page's text content with its url/title/description as metadata.

## Reference

- Sync script: `scripts/search/sync-chroma.ts` (also runnable directly: `bun run search:sync:chroma`)
- Client: `src/lib/search/providers/chroma-client.ts`
