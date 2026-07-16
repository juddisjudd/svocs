# __SITE_NAME__

A documentation site built with [SVOCS](https://github.com/juddisjudd/svocs).

## Developing

```sh
bun install
bun run dev
```

Open `http://localhost:5173`.

## Building

```sh
bun run build
```

Prerenders every page and builds the Pagefind search index into `build/`. Preview it with:

```sh
bun run preview
```

## Adding content

Drop a `.md` (or `.svx` for live components) file under `content/` — it becomes a route automatically. See the [Writing Content](https://svocs.dev/docs/writing-content) and [Navigation](https://svocs.dev/docs/navigation) guides for the full authoring and sidebar-configuration schema.

## Deploying

See the [Deployment guide](https://svocs.dev/docs/deployment) for Cloudflare Pages, GitHub Pages, and other static hosts. Deploying under a sub-path (like GitHub Pages project sites)? Set the `BASE_PATH` environment variable at build time:

```sh
BASE_PATH=/my-repo bun run build
```
