# svocs-cli

Companion CLI for [SVOCS](https://svocs.dev) docs sites scaffolded with `create-svocs-docs`.

```sh
npx svocs-cli doctor
npx svocs-cli update
```

(or `bunx svocs-cli`, `pnpm dlx svocs-cli`; a global install provides the `svocs` command)

## `svocs doctor [dir]`

Checks a site for the configuration problems that actually bite people:

- `SITE_URL` still empty in `src/lib/site.ts` — social-card tags are off, `sitemap.xml` ships empty, and `llms.txt` links stay relative until it's set.
- `robots.txt` missing its `Sitemap:` line when `SITE_URL` is set.
- Missing OG card fonts (`static/fonts/satoshi-*.woff2`), which fail the build's card generation step.
- Server-backed search backends (Typesense, Chroma) configured without their required env vars.
- A newer template version available on npm.

Exit code is non-zero when an error-level problem is found, so it works in CI.

## `svocs update [dir]`

Applies template fixes to a scaffolded site without touching your work. Sites scaffolded with `create-svocs-docs` >= 0.18 include a `.svocs.json` manifest recording the template version, the options you scaffolded with, and a hash of every file as generated. `update` fetches the latest template, rebuilds what an untouched scaffold with your options would look like, and then, file by file:

- files you never modified that the template changed are **updated**
- files you modified are **skipped** and listed for manual review
- files the template added are **added**
- files the template dropped are reported but **never deleted**

| Flag           | Effect                                                          |
| -------------- | --------------------------------------------------------------- |
| `--dry-run`    | Show the plan without writing anything                          |
| `--yes`        | Apply without the confirmation prompt (required when not a TTY) |
| `--force`      | Re-sync even when the version already matches                   |
| `--from=<dir>` | Use a local `create-svocs-docs` package instead of npm          |

`package.json` follows the same rule: if you've added dependencies (you probably have), it's skipped and called out, since merging dependency changes is a decision, not a diff.

## `svocs migrate <source> <target>`

Converts an existing docs site into a new svocs site. Supported sources: [Fumadocs](https://fumadocs.dev/), [Nextra](https://nextra.site/), [Docusaurus](https://docusaurus.io/), [Starlight](https://starlight.astro.build/), [MkDocs](https://www.mkdocs.org/), and [mdBook](https://rust-lang.github.io/mdBook/).

All of these are tools we respect — Fumadocs and Nextra especially are projects we love. This command isn't a pitch to leave them; it's here so that trying a Svelte-based docs site is an afternoon's experiment instead of a rewrite. Your source site is never touched.

The framework is auto-detected (or forced with `--source=<framework>`). It scaffolds fresh, converts the content tree, and reports what needs a human:

- Frontmatter, sidebar ordering, and titles carry over (`meta.json`, `_meta.js`, `sidebar_position`/`_category_.json`, `sidebar:` frontmatter, `nav:`, or `SUMMARY.md`, depending on the source) as `_meta.json`.
- Components map to their svocs equivalents: callouts/admonitions/asides become `<Callout>`, tab constructs become `<Tabs items={…}>`/`<Tab>`, MkDocs `???` collapsibles become `<Collapse>`, card grids become `<Cards>`/`<Card>`.
- MDX indentation, JSX comments, and relative links are rewritten to what mdsvex and static routes expect.
- Anything unmappable (custom components, raw JSX, `{{#include}}`) is commented out in place with `svocs migrate TODO` markers instead of breaking the build.
- Dead links inherited from the source are listed, and the new site warns on them during prerender rather than failing.

Flags: `--source=<framework>`, `--site-name`, `--site-url`, `--repo-url`, `--accent`, `--search`, `--from=<dir>`.

## License

MIT
