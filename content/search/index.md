## Picking a backend

SVOCS ships five interchangeable search backends behind one switch: **Pagefind** (the zero-config default), **Orama**, **FlexSearch**, **Typesense**, and **Chroma**. The docs UI (the ⌘K dialog, keyboard navigation, result rendering) is identical no matter which one is active; only how the index gets built and queried changes.

Set `PUBLIC_SVOCS_SEARCH_PROVIDER` at build time to switch:

```sh
PUBLIC_SVOCS_SEARCH_PROVIDER=orama bun run build
```

Leave it unset and you get Pagefind, which needs no configuration and no extra process.

## The three shapes

| Backend                               | How the index is built                                                                            | Who runs it                   | Live server?              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------- |
| [Pagefind](/docs/search/pagefind)     | WASM search index generated from your built HTML                                                  | A post-build CLI step         | No                        |
| [Orama](/docs/search/orama)           | Raw page content shipped as static JSON, indexed in-browser                                       | Part of the static build      | No                        |
| [FlexSearch](/docs/search/flexsearch) | Same idea, different in-browser index library                                                     | Part of the static build      | No                        |
| [Typesense](/docs/search/typesense)   | Content pushed to a collection on your Typesense server                                           | A sync script after the build | Yes, self-hosted or cloud |
| [Chroma](/docs/search/chroma)         | Content pushed to a collection on your Chroma server (semantic search — server embeds it for you) | A sync script after the build | Yes, self-hosted          |

Pagefind, Orama, and FlexSearch keep the site fully static: there is no search server to host, so there's also nothing that can go down. Typesense and Chroma trade that away for a live, queryable server, which buys better relevance tuning and (for Chroma) semantic search, at the cost of standing up and securing a service the browser talks to directly.

## Adding a backend to a scaffolded project

`create-svocs-docs` only ships Pagefind by default, to keep a fresh scaffold's install small. The other four backends are documented, working code you copy in when you actually want them. Each backend's page below has the exact files and the one package to install.
