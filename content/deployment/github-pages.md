## Sub-path hosting and BASE_PATH

Project sites are served from `https://<user>.github.io/<repo>/`, a sub-path rather than the domain root. Tell the build about it with the `BASE_PATH` environment variable:

```sh
BASE_PATH=/my-repo bun run build
```

Every internal link, asset URL, and the search index loader respect this automatically. (User/organization sites served from the domain root can skip `BASE_PATH` entirely.)

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

## Verify locally

You can reproduce exactly what Pages will serve:

```sh
BASE_PATH=/my-repo bun run build
bun run preview
# visit http://localhost:4173/my-repo
```
