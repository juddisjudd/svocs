## How it works

Every build generates a 1200×630 social preview card for every page. Links shared to Slack, Discord, X, or anywhere else that reads Open Graph tags get a branded card with that page's title and description instead of a generic site image. This page's own card, exactly as scrapers see it:

![The social preview card for this page: site name with an accent tick, the page title and description, a breadcrumb, and the site domain on a dark background](/og-card-example.png)

Generation runs as a post-build step (`scripts/og/generate.mjs`) after `vite build`:

```txt
build/docs/theming.html  →  build/og/docs/theming.png
build/index.html         →  build/og/index.png
```

Each page's `og:image` meta tag points at its card by the same path mapping, so nothing needs to be wired per page. Titles and descriptions are read back out of the built HTML's own `og:title` and `meta description` tags, which means the card can never drift from what the page actually declares.

Rendering uses [Takumi](https://takumi.kane.tw/), a Rust renderer with native Node bindings that draws the card straight to PNG, so builds never need Chromium.

## Set your site URL

Scrapers require absolute `og:image` URLs. The scaffolder's production-URL prompt sets this up for you; if you skipped it, set `SITE_URL` in `src/lib/site.ts` to your production origin:

```ts filename="src/lib/site.ts"
export const SITE_URL = 'https://docs.example.com';
```

Until it's set, the `og:image` and `twitter:image` tags are omitted. Scrapers ignore relative image URLs, and a relative URL would also send SvelteKit's prerender crawler looking for cards that haven't been generated yet, which fails the build with a 404. The cards themselves are generated either way, so setting `SITE_URL` is the only step left to turn them on.

## Custom accent colors

The card reads `--accent` out of `src/routes/+layout.svelte` at generation time, the same variable the rest of the theme derives from. Pick a different accent during scaffolding (or edit it later) and the cards recolor to match: the brand tick, the corner glow, the breadcrumb, and the bottom bar.

## Customizing the card

The entire card layout lives in the `card()` function inside `scripts/og/generate.mjs`, written as a small element tree. Edit it like HTML with inline styles.

Takumi supports a broad CSS subset (flexbox, grid, gradients, border-radius, line clamping, shadows). If a style seems ignored, check the [Takumi documentation](https://takumi.kane.tw/) for what's supported.

## Skipping generation

Set `SVOCS_OG=0` to skip the step entirely:

```sh
SVOCS_OG=0 bun run build
```

Pages will still emit `og:image` tags pointing at `/og/*.png`; scrapers that find a 404 there fall back to a plain text preview.
