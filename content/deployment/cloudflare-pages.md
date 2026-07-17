Cloudflare has two ways to host a static site from Git: the newer **Workers Builds** (the default when you create from **Workers & Pages** today) and classic **Pages**. Both work; they need slightly different settings. Every scaffold ships a `wrangler.jsonc` preconfigured for the Workers path.

## Workers Builds (recommended)

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository**.
2. Select your repository and use these settings:

| Setting        | Value                          |
| -------------- | ------------------------------ |
| Build command  | `bun install && bun run build` |
| Deploy command | `npx wrangler deploy`          |

The `wrangler.jsonc` at the project root tells Wrangler what to deploy — the static `build/` directory, with `404.html` served for unknown routes:

```jsonc filename="wrangler.jsonc"
{
	"name": "my-docs",
	"compatibility_date": "2026-07-01",
	"assets": {
		"directory": "./build",
		"not_found_handling": "404-page"
	}
}
```

> **The install step is not optional.** Workers Builds detects Bun from your lockfile but runs only the command you give it — a build command of just `npm run build` or `bun run build` fails with `vite: not found` because dependencies were never installed.

## Classic Pages

1. Go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select your repository and the production branch.
3. Use these build settings:

| Setting                | Value                          |
| ---------------------- | ------------------------------ |
| Framework preset       | None (or SvelteKit static)     |
| Build command          | `bun install && bun run build` |
| Build output directory | `build`                        |

Pages usually installs dependencies automatically, but the explicit install makes the command portable between the two systems.

Either way, sites deploy at the root of a `*.workers.dev` or `*.pages.dev` domain, so no `BASE_PATH` is needed.

## Deploy from the CLI instead

If you'd rather push builds directly (or from your own CI):

```sh
bun run build
npx wrangler deploy                                    # Workers, uses wrangler.jsonc
bunx wrangler pages deploy build --project-name my-docs  # classic Pages
```

## Production tips

- **Preview deployments**: every pull request automatically gets its own preview URL.
- **Custom domains**: add one under **Custom domains** in the project settings; TLS is provisioned for you.
- **Redirects/headers**: drop a `_redirects` or `_headers` file into `static/` and it ships with the build:

```txt filename="static/_redirects"
/old-guide  /docs/getting-started  301
```

- **Search works out of the box**: the Pagefind index is part of `build/`, so no extra step is required.
