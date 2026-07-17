## Connect your repository

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select your repository and the production branch.
3. Use these build settings:

| Setting                | Value                          |
| ---------------------- | ------------------------------ |
| Framework preset       | None (or SvelteKit static)     |
| Build command          | `bun install && bun run build` |
| Build output directory | `build`                        |

Sites deploy at the root of a `*.pages.dev` domain, so no `BASE_PATH` is needed.

> **Keep the install in the build command.** Pages usually installs dependencies automatically, but not every build path does — a build command without the install fails with `vite: not found`. The explicit `bun install &&` costs seconds and works everywhere. Cloudflare's build image detects `bun.lock` and provisions Bun for you.

> Make sure you create the project through **Pages → Connect to Git**, not "Import a repository" at the Workers & Pages root — the latter creates a Worker with a different build pipeline that needs its own configuration.

## Deploy from the CLI instead

If you'd rather push builds directly (or from your own CI), use Wrangler:

```sh
bun run build
bunx wrangler pages deploy build --project-name my-docs
```

## Production tips

- Every pull request gets its own preview URL automatically.
- Add a custom domain under **Custom domains** in the project settings; TLS is provisioned for you.
- Drop a `_redirects` or `_headers` file into `static/` and it ships with the build:

```txt filename="static/_redirects"
/old-guide  /docs/getting-started  301
```

- The Pagefind index is already part of `build/`, so search works with no extra step.
- Pages builds use a shallow clone, so the per-page "last updated" date (pulled from git history) is omitted for most files. The site works fine without it — deploy from your own CI with full history if you want the dates back.
