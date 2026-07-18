## What it is

`svocs` is the companion CLI for sites scaffolded with `create-svocs-docs`. The scaffolder gets you a working site; `svocs` keeps it working after day one. It has three commands: `doctor` checks a site's configuration, `update` pulls template fixes into it, and `migrate` converts an existing docs site — Fumadocs, Nextra, Docusaurus, Starlight, MkDocs, or mdBook — into a new svocs one.

It needs no install step. Run it from your site's directory:

```sh
npx svocs-cli doctor
```

`bunx svocs-cli` and `pnpm dlx svocs-cli` work the same way, and installing the package globally gives you the shorter `svocs` command. Both commands also accept a path (`svocs doctor ../my-docs`) if you'd rather not `cd`.

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

The exit code is non-zero when an error-level problem is found, so `npx svocs-cli doctor` works as a CI step.

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

| Flag        | Effect                                                           |
| ----------- | ---------------------------------------------------------------- |
| `--dry-run` | Print the plan without writing anything                          |
| `--yes`     | Apply without the confirmation prompt (required in CI / non-TTY) |
| `--force`   | Re-sync even when the template version already matches           |

Since your content lives in `content/` and is either starter pages you've rewritten or your own files, it's protected by the same hash check as everything else. `update` has no special cases.

## svocs migrate

Converts an existing docs site into a new svocs site:

```sh
npx svocs-cli migrate ../my-docs-site ../my-svocs-site
```

First, the honest part: every framework this command reads from is good software. [Fumadocs](https://fumadocs.dev/) and [Nextra](https://nextra.site/) in particular are projects we love — much of svocs's authoring model is a tribute to theirs — and [Docusaurus](https://docusaurus.io/), [Starlight](https://starlight.astro.build/), [MkDocs](https://www.mkdocs.org/), and [mdBook](https://rust-lang.github.io/mdBook/) have each earned their place. `migrate` isn't here to argue you out of any of them. It exists because people who write docs deserve options, and "I'd try the Svelte one if moving weren't a weekend of regex" shouldn't be the reason you can't. Your source site is never modified, so trying svocs costs an afternoon and reversing the experiment costs nothing.

The source framework is auto-detected (override with `--source=fumadocs|nextra|docusaurus|starlight|mkdocs|mdbook`). The converter scaffolds a fresh site, then converts the source's content tree:

| Source     | What maps over                                                                                                                                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fumadocs   | `content/docs/` MDX; `<Tabs>`/`<Callout>`/`<Cards>` map directly (`error` → `danger`); `[step]` headings become `<Steps>`; `meta.json` → `_meta.json`; `icon` (frontmatter or meta.json) and `<DocsCategory />` map to svocs [page icons](/docs/components#page-icons) and `<Cards auto>` |
| Nextra     | `content/` or `pages/` MDX; `<Callout>`, `<Steps>`, `<Tabs items={…}>` pass through; `Tabs.Tab`/`Cards.Card`/`FileTree.*` lose the dots; `_meta.json` and (best-effort) `_meta.js/tsx` → `_meta.json`                                                                                     |
| Docusaurus | `docs/` tree; `:::note`-style admonitions become `<Callout>`; `<Tabs>`/`<TabItem>` become the `items` shape; `01-` number prefixes, `sidebar_position`, and `_category_.json` become `_meta.json` ordering; `<DocCardList />` becomes `<Cards auto>`                                      |
| Starlight  | `src/content/docs/`; asides (both `:::` and `<Aside>`) become `<Callout>`; `CardGrid`/`LinkCard` become `Cards`/`Card`; `sidebar:` frontmatter becomes ordering; root-relative links gain the `/docs` prefix; `Card` `icon` names translate where Starlight's vocabulary overlaps svocs's |
| MkDocs     | `docs/` markdown; `!!! note` admonitions become `<Callout>`, `??? tip` collapsibles become `<Collapse>`, `=== "Tab"` content tabs become `<Tabs>`; the `mkdocs.yml` `nav:` becomes `_meta.json`; Material for MkDocs' frontmatter `icon: material/…` translates to a svocs page icon      |
| mdBook     | `src/` markdown; `SUMMARY.md` becomes ordering (part headings become sidebar separators); `README.md` chapters become index pages; rust hidden lines (`# `) are stripped; `mdbook-admonish` blocks become `<Callout>`                                                                     |

Everywhere, the same rules apply:

- Frontmatter (`title`, `description`) carries over; pages that open with a lone `# Title` have it hoisted into frontmatter, since the svocs layout renders the title itself.
- Relative links are rewritten to absolute `/docs/` routes, and pages that use components come out as `.svx`, plain ones as `.md`.
- Anything the converter can't map honestly — custom components, raw JSX, `{{#include}}` calls — is commented out in place with a `svocs migrate TODO` marker, so nothing breaks the build and porting is copy-paste work. It never guesses.
- Icon names are translated against svocs's curated set where the source uses a comparable string-based vocabulary (Fumadocs, Material for MkDocs, some of Starlight's). An icon with no equivalent, or one that's a JSX element rather than a name at all (Nextra), is dropped with a note rather than left broken — pick a replacement from `/docs/components#page-icons` by hand if you want one there.

Dead internal links carried over from the source are reported at the end, and the new site is configured to warn on them instead of failing prerender; tighten that back up in `vite.config.ts` once they're fixed.

Flags: `--site-name`, `--site-url`, `--repo-url`, `--repo-branch` (default `main`; feeds "Edit on GitHub" links, not the header button), `--accent`, and `--search` mirror the scaffolder's prompts.

Migrating from something not listed? Open an issue — the converter is built to grow one source at a time. And if you try svocs and go back, that's a fine outcome too; the point was that you got to choose.

## Sites scaffolded before 0.18

Older scaffolds have no `.svocs.json`, so `update` can't tell your edits from template files and refuses to guess. `doctor` still works. To adopt updates on an older site, compare it against a fresh scaffold once by hand, then keep the fresh scaffold's manifest.
