## Connect your repository

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select your repository and the production branch.
3. Use these build settings:

| Setting                | Value                      |
| ---------------------- | -------------------------- |
| Framework preset       | None (or SvelteKit static) |
| Build command          | `npm run build`            |
| Build output directory | `build`                    |

That's it. Sites deploy at the root of a `*.pages.dev` domain, so no `BASE_PATH` is needed.

> Prefer Bun? Set the build command to `bun run build`. Cloudflare's build image detects `bun.lock` and provisions Bun automatically.

## Deploy from the CLI instead

If you'd rather push builds directly (or from your own CI), use Wrangler:

```sh
bun run build
bunx wrangler pages deploy build --project-name my-docs
```

## Production tips

- **Preview deployments**: every pull request automatically gets its own preview URL.
- **Custom domains**: add one under **Custom domains** in the project settings; TLS is provisioned for you.
- **Redirects/headers**: drop a `_redirects` or `_headers` file into `static/` and it ships with the build:

```txt filename="static/_redirects"
/old-guide  /docs/getting-started  301
```

- **Search works out of the box**: the Pagefind index is part of `build/`, so no extra step is required.
