## What it is

`svocs` is the companion CLI for sites scaffolded with `create-svocs-docs`. The scaffolder gets you a working site; `svocs` keeps it working after day one. It has two commands: `doctor` checks a site's configuration, `update` pulls template fixes into it.

It needs no install step. Run it from your site's directory:

```sh
npx svocs doctor
```

`bunx svocs` and `pnpm dlx svocs` work the same way. Both commands also accept a path (`svocs doctor ../my-docs`) if you'd rather not `cd`.

## svocs doctor

Checks for the problems that actually reach our issue tracker:

- `SITE_URL` still empty in `src/lib/site.ts` — [social cards](/docs/og-images) stay off, `sitemap.xml` ships empty, and `llms.txt` links stay relative until it's set.
- `robots.txt` missing its `Sitemap:` line even though `SITE_URL` is set.
- Missing card fonts under `static/fonts/`, which fail the build's OG generation step.
- A server-backed search backend (Typesense, Chroma) configured without the env vars it needs, which fails `bun run build`.
- A newer template version available on npm.

```txt
┌  svocs doctor
│
◆  Scaffolded from create-svocs-docs 0.18.0 (.svocs.json present).
◆  SITE_URL is set (https://docs.example.com).
◆  OG card fonts present.
◆  Search backend "orama" needs no server config.
◆  Template is up to date.
│
└  All checks passed.
```

The exit code is non-zero when an error-level problem is found, so `npx svocs doctor` works as a CI step.

## svocs update

Scaffolded sites are snapshots: a bug fixed in the template after you scaffold never reaches your site. `update` closes that gap without touching your work.

It relies on the `.svocs.json` manifest that `create-svocs-docs` 0.18+ writes at scaffold time — the template version, the options you picked, and a hash of every file as it was generated. `update` fetches the latest template, rebuilds what an untouched scaffold with your options would look like, and compares file by file:

```txt
┌  svocs update
│
◇  Fetched create-svocs-docs 0.19.0
│
●  update  scripts/og/generate.mjs
▲  skip    content/introduction.md (you modified it)
│
◆  Apply 1 file(s) from template 0.19.0? Yes
│
└  Template 0.18.0 → 0.19.0: 1 updated, 1 skipped (modified by you).
```

The rules:

- Files you never modified that the template changed are **updated**.
- Files you modified are **skipped** and listed, so template changes to them become a manual review instead of a silent overwrite.
- Files new in the template are **added**.
- Files the template dropped are reported but never deleted — your code may still import them.

`package.json` follows the same rules, which in practice means it's skipped once you've added a dependency. When that happens `update` says so; compare its dependencies against the new template if a build breaks after updating.

| Flag | Effect |
| --- | --- |
| `--dry-run` | Print the plan without writing anything |
| `--yes` | Apply without the confirmation prompt (required in CI / non-TTY) |
| `--force` | Re-sync even when the template version already matches |

Since your content lives in `content/` and is either starter pages you've rewritten or your own files, it's protected by the same hash check as everything else. `update` has no special cases.

## Sites scaffolded before 0.18

Older scaffolds have no `.svocs.json`, so `update` can't tell your edits from template files and refuses to guess. `doctor` still works. To adopt updates on an older site, compare it against a fresh scaffold once by hand, then keep the fresh scaffold's manifest.
