## Static output

`bun run build` prerenders every page with `adapter-static` and writes plain HTML, CSS, and JS to `build/`. The output needs no Node server, serverless functions, or environment variables at runtime. That output can be deployed to any static host.

## Cloudflare

This project ships a `wrangler.jsonc` preconfigured for Cloudflare's Workers Builds: connect the repository under **Workers & Pages → Import a repository**, set the build command to `bun install && bun run build`, and the deploy command to `npx wrangler deploy`.

The install step matters — Workers Builds runs exactly the command you give it, so a build command without an install fails with `vite: not found`.

On classic Cloudflare Pages, use the same build command with `build` as the output directory; the `wrangler.jsonc` is ignored there.

## GitHub Pages

GitHub Pages serves project sites from a sub-path (`https://user.github.io/my-repo/`), so set the `BASE_PATH` environment variable at build time:

```sh
BASE_PATH=/my-repo bun run build
```

This is wired into `vite.config.ts`'s `paths.base`, which every internal link and asset reference in this template already respects. Commit a `.nojekyll` file at the site root (already included in `static/`) so GitHub Pages doesn't try to process the output with Jekyll.

## Any other static host

Anywhere that can serve a directory of static files (Vercel, Netlify, S3 plus a CDN, your own server behind nginx) works the same way: run the build and upload `build/`.
