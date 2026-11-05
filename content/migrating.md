Moving an existing docs site to svocs has two parts. `svocs migrate` converts the content in about a minute. The parts of the old site that were code, such as custom components, the header and the landing page, you port by hand. For a site of around a hundred pages, plan on an afternoon.

Your source site is never modified, so you can stop at any step and nothing is lost.

## Before you start

- Node.js 22.17 or newer. The generated site requires it.
- [Bun](https://bun.sh). The commands on this page use it.
- The source site checked out on your machine, for example with `git clone`.

## 1. Run the migration

```sh
npx svocs-cli@latest migrate ../old-docs ../new-docs \
  --site-name="My Project" \
  --site-url=https://docs.example.com \
  --repo-url=https://github.com/me/docs \
  --accent=#3b82f6
```

The first path is the source site. The second is a new or empty folder for the svocs site. Keep `@latest`: without it, `npx` can run an older copy it cached earlier.

The flags are optional:

- `--site-name`: the name in the header and page titles. Defaults to a name read from the source site's config or `package.json`.
- `--site-url`: the production URL, used for the sitemap, social cards and `llms.txt`. Include the sub-path if the site has one.
- `--repo-url`: the header's GitHub button and the "Edit on GitHub" links.
- `--repo-branch`: the branch "Edit on GitHub" links point at. Defaults to `main`.
- `--accent`: the theme color.
- `--search`: the search backend. Defaults to Pagefind. See [Search](/docs/search).

You can change the name, URLs and branch later in `src/lib/site.ts`, and the accent in `src/routes/+layout.svelte`.

## 2. Read the report

The migration ends with a report. It has four kinds of lines:

- **Converted pages**: how many pages became `.md` and `.svx` files, and how many `_meta.json` files carry the sidebar order.
- **TODO lines**: pages with blocks the converter could not map. Step 3 covers these.
- **Notes**: things it mapped but wants you to check, such as card lists, copied static files, or icons with no svocs equivalent.
- **Dead links**: links to pages that do not exist. Most were already broken on the old site. Step 5 covers these.

[CLI](/docs/cli#svocs-migrate) lists what each source framework's syntax becomes.

## 3. Port the TODO blocks

Search the new site for `svocs migrate TODO`. Each match is a block the converter commented out instead of guessing, so the site still builds. Common cases:

| Source block                                                    | What to do                                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A custom component, such as `<ResourceLinks repo="x" />`        | Rewrite it as a Svelte component. See [Your own components](#your-own-components). |
| Raw JSX with `style={{…}}` or `className=`                      | Rewrite it as plain HTML with `style="…"` and `class="…"`.                         |
| An include of one section, such as `<include>a.mdx#b</include>` | Link to that section instead. svocs includes whole pages only.                     |
| An mdBook `{{#include}}`                                        | Paste the included content in.                                                     |

### Your own components

Components from React-based sites (Fumadocs, Nextra, Docusaurus) need a rewrite in Svelte. That is usually short: props come from `$props()`, `className` becomes `class`, and `{cond && <X />}` becomes `{#if cond}<X />{/if}`.

Put your components in a folder of your own, such as `src/lib/my-site/`. `svocs update` only writes files that come from the svocs template, so it never touches that folder. Then import them in any `.svx` page:

```svelte filename="content/guide.svx"
<script>
	import ResourceLinks from '#lib/my-site/ResourceLinks.svelte';
</script>

<ResourceLinks repo="my-repo" />
```

A page that uses a component must be a `.svx` file. Rename it from `.md` to `.svx`. Its URL does not change.

### Reusing a page inside another page

Import another content page and render it like a component. svocs adds its headings to the host page's table of contents, and its text to search and `llms.txt`:

```svelte filename="content/ped.svx"
<script>
	import EntityMethods from './entity-methods.svx';
</script>

<EntityMethods />
```

If the shared page should not appear in the sidebar on its own, set `"hidden": true` on it in `_meta.json`. See [Navigation](/docs/navigation#fields).

## 4. Port the site around the content

The converter only reads the content folder. Everything else on the old site was code, so it does not carry over:

| Part of the old site | Where it goes in svocs                                                      |
| -------------------- | --------------------------------------------------------------------------- |
| Header links         | Add `<a>` elements to the `actions` block in `src/routes/+layout.svelte`.   |
| Footer               | The `<footer>` in `src/routes/+layout.svelte`.                              |
| Landing page         | `src/routes/+page.svelte`.                                                  |
| Favicon              | Copy it into `static/`, then set the `<link rel="icon">` in `src/app.html`. |
| Colors and fonts     | See [Theming](/docs/theming).                                               |
| Analytics scripts    | Add them to `<head>` in `src/app.html`.                                     |

For Fumadocs, Nextra, Starlight and Docusaurus sites, files in the source's `public/` (or Docusaurus `static/`) folder are already copied into `static/`. Next.js apps often keep the favicon in `app/` instead, so check there too.

## 5. Fix dead links, then make the build strict

1. Run `bun install`, then `bun run build`. The build prints a warning for each link to a missing page and each link to a missing `#anchor`. This includes links the report could not check, such as `/guide` on a site whose docs lived under `/docs`.
2. Fix each link in `content/`.
3. In `vite.config.ts`, delete the `prerender: { handleHttpError: 'warn', handleMissingId: 'warn' }` line and the comment above it.

From then on, a broken link fails the build instead of shipping. See [Troubleshooting](/docs/troubleshooting).

## 6. Preview

```sh
bun run dev
```

Then open `http://localhost:5173/docs`. To check the exact files you will deploy, run `bun run build`, then `bun run preview`.

## 7. Deploy

Follow [Cloudflare Pages](/docs/deployment/cloudflare-pages) or [GitHub Pages](/docs/deployment/github-pages). If the old site used a custom domain on GitHub Pages, read [Custom domain](/docs/deployment/github-pages#custom-domain) first: the default workflow builds for a sub-path.

"Edit on GitHub" links point at `content/<page>` in the repository from `--repo-url`. They work once the new site sits at the root of that repository, for example after a pull request that replaces the old site's files with the new ones.
