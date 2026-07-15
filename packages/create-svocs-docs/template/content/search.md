## Search, out of the box

This site ships with [Pagefind](https://pagefind.app) wired up already — zero config, no server, no API keys. `bun run build` indexes every page after `vite build`, and the `⌘K` dialog in the header queries it entirely client-side.

## Want a different backend?

SVOCS also supports Orama, FlexSearch, Typesense, and Chroma behind the exact same `⌘K` dialog. If you picked one of those during `create-svocs-docs` setup, it's already wired up — otherwise, none of them are bundled into this starter by default, to keep a fresh install small. Pick one, install the one package it needs, and follow the setup guide:

**[svocs.dev/docs/search](https://svocs.dev/docs/search)**
