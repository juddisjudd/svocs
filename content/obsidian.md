## Open `content/` as a vault

SVOCS reads Obsidian's markdown dialect natively, so the simplest workflow is no sync at all: in Obsidian, choose **Open folder as vault** and point it at your site's `content/` directory. Notes you write there are pages; folders are sections; the sidebar follows the same [`_meta.json`](/docs/navigation) rules as always.

Add `.obsidian/` to `.gitignore` (new scaffolds already do) so workspace state stays local. If you want Obsidian to commit and push for you, the community [Obsidian Git](https://github.com/Vinzent03/obsidian-git) plugin does exactly that, and every push rebuilds the site.

## What's translated

A preprocessor (`src/lib/build/obsidian.ts`, listed before mdsvex in `vite.config.ts`) rewrites Obsidian syntax at build time. Fenced code, inline code, frontmatter, and `<script>` blocks are never touched.

| You write                                   | The page gets                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `[[Getting Started]]`                       | `[Getting Started](/docs/getting-started)` — resolved by file name or vault path, like Obsidian does |
| `[[Getting Started\|start here]]`           | the alias as link text                                                                               |
| `[[Getting Started#Add a page]]`            | a link to that heading's anchor                                                                      |
| `![[diagram.png]]`, `![[diagram.png\|320]]` | an image from `static/` (found by file name anywhere under it), with an optional width               |
| `> [!tip] Title` + quoted body              | a [`<Callout>`](/docs/components#callout) of the matching type; the import is added for you          |
| `==highlighted==`                           | `<mark>highlighted</mark>`                                                                           |
| `%% comment %%` (inline or block)           | nothing                                                                                              |
| `publish: false` or `draft: true`           | the page is left out of the build: no route, no sidebar entry, no search hit, not in `llms.txt`      |

Callout types map onto the five SVOCS variants: `note`/`abstract`/`quote` → note, `info`/`todo`/`question`/`example` → info, `tip`/`hint`/`important`/`success` → tip, `warning`/`caution`/`attention` → warning, `danger`/`error`/`bug`/`failure` → danger. Foldable markers (`[!tip]-`) are accepted and ignored.

Two things don't translate. Note embeds (`![[Other Note]]`) become links, since SVOCS has no transclusion. A wikilink whose target doesn't exist is left exactly as written and reported in the build log, so a typo shows up as literal `[[brackets]]` on the page rather than a 404 that fails prerendering.

## Attachments

Obsidian stores attachments wherever the vault's settings say; SVOCS serves files from `static/`. Set Obsidian's **Files & links → Default location for new attachments** to a folder under `static/` (for example `static/attachments`, which means pointing the vault at the site root rather than `content/`), or just keep images in `static/` and reference them with `![[name.png]]` — the lookup is by file name, so the exact folder doesn't matter.

If you'd rather keep the vault on `content/` only, `static/` isn't visible to Obsidian's picker, but `![[name.png]]` still resolves at build time.

## Frontmatter

Obsidian's Properties panel edits the same YAML frontmatter SVOCS reads, so `title`, `description`, `order`, `tags`, and `icon` work from either side. Obsidian-specific keys (`aliases`, `cssclasses`) are ignored.

## Migrating an existing vault

If you'd rather convert a vault into a plain-markdown site once and leave Obsidian behind, `svocs migrate` has an Obsidian adapter:

```sh
npx svocs-cli migrate ~/Vaults/project-notes ./project-docs
```

It resolves wikilinks against the vault's own note index, copies attachments into `static/attachments/`, converts callouts and highlights, slugifies file names (`Writing Notes.md` → `writing-notes.md`), skips notes marked `publish: false` and the configured templates folder, and comments out Dataview blocks and Templater expressions with a `svocs migrate TODO` marker. The vault itself is never modified. See the [CLI](/docs/cli#svocs-migrate) page for the rest of the migrate options.

## Live example

This section of the page is written in Obsidian syntax. The link to [[getting-started|the quick start]] is a wikilink with an alias, the callout below is a `> [!tip]` block, and ==this== is a highlight. %% This comment never reaches the page. %%

> [!tip] It just builds
> No import, no component tag. Look at the [source](https://github.com/juddisjudd/svocs/blob/main/content/obsidian.md) of this page to compare.
