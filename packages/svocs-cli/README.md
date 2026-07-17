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

| Flag | Effect |
| --- | --- |
| `--dry-run` | Show the plan without writing anything |
| `--yes` | Apply without the confirmation prompt (required when not a TTY) |
| `--force` | Re-sync even when the version already matches |
| `--from=<dir>` | Use a local `create-svocs-docs` package instead of npm |

`package.json` follows the same rule: if you've added dependencies (you probably have), it's skipped and called out, since merging dependency changes is a decision, not a diff.

## `svocs migrate <source> <target>`

Converts a [fumadocs](https://fumadocs.dev/) site into a new svocs site: scaffolds fresh, converts every page under `content/docs/`, and reports what needs a human.

- Frontmatter and `meta.json` ordering carry over; `[step]` headings become `<Steps>`; `<Tabs>`, `<Callout>`, and `<Cards>` map to the svocs components directly.
- MDX indentation, JSX comments, and relative links are rewritten to what mdsvex and static routes expect.
- Custom components and dynamic JSX are commented out in place with `svocs migrate TODO` markers instead of breaking the build.
- Dead links inherited from the source are listed, and the new site warns on them during prerender rather than failing.

Flags: `--site-name`, `--site-url`, `--repo-url`, `--accent`, `--search`, `--from=<dir>`.

## License

MIT
