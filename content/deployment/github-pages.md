## Sub-path hosting and BASE_PATH

Project sites are served from `https://<user>.github.io/<repo>/`, a sub-path rather than the domain root. Tell the build about it with the `BASE_PATH` environment variable:

```sh
BASE_PATH=/my-repo bun run build
```

Every internal link, asset URL, and the search index loader respect this automatically. Sites served from a domain root skip `BASE_PATH` entirely: a `<user>.github.io` repository, or any site on a [custom domain](#custom-domain).

Set `SITE_URL` in `src/lib/site.ts` to the full URL the site is served at, sub-path included, such as `https://<user>.github.io/<repo>`. The sitemap, `llms.txt` and social cards build their absolute URLs from it.

A `.nojekyll` file already ships in `static/`, so GitHub won't run the output through Jekyll or strip underscore-prefixed asset folders.

## Deploy with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy docs to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          # full history so "Last updated on" dates come from real commits
          fetch-depth: 0
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build
        # Delete these two lines for a custom domain or a <user>.github.io repository.
        env:
          BASE_PATH: /${{ github.event.repository.name }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then in your repository settings, set **Settings → Pages → Source** to **GitHub Actions**. Every push to `main` builds and publishes the site.

> Using npm instead of Bun? Swap the two Bun steps for `actions/setup-node@v4`, `npm ci`, and `npm run build`.

## Custom domain

A site on a custom domain, such as `docs.example.com`, is served from the domain root, so it needs no `BASE_PATH`:

1. In the workflow above, delete the `env:` and `BASE_PATH:` lines under `bun run build`. If you keep them, every page and asset is built under `/<repo>/` and the site loads without styles or scripts.
2. Set `SITE_URL` in `src/lib/site.ts` to `https://docs.example.com`.
3. In **Settings → Pages → Custom domain**, enter the domain and select **Save**. Select **Enforce HTTPS** once it becomes available, which can take up to a day.

A `CNAME` file in `static/` does not set the domain here. GitHub ignores it when a workflow publishes the site, so the setting in step 3 is what counts. Keeping the file does no harm, and `svocs migrate` copies it over from an old site's `public/` folder.

## Verify locally

You can reproduce exactly what Pages will serve:

```sh
BASE_PATH=/my-repo bun run build
bun run preview
# visit http://localhost:4173/my-repo
```

For a custom domain, build without `BASE_PATH` and visit `http://localhost:4173` instead.
