## What `_meta.json` controls

Drop a `_meta.json` file in any `content/` folder (including the root) to control that folder's slice of the sidebar — order, display titles, and category grouping — independent of file names or frontmatter.

```json filename="content/_meta.json"
{
	"items": {
		"introduction": { "order": 1 },
		"getting-started": { "title": "Quick Start", "order": 2 }
	}
}
```

Each key under `items` is a file or folder name (no extension) relative to that `_meta.json`.

## Fields

- `title` — overrides the display title, in both the sidebar and on the page itself.
- `order` — a sort key. Lower sorts first. Items without an explicit order default to `999` and sort after everything that has one.
- `type: "separator"` — turns this entry into a non-clickable heading (see below) instead of pointing at a real file.

## Precedence

A page's title and order can come from four places. From highest priority to lowest:

1. `_meta.json` in the page's directory
2. The page's own sidecar `name.meta.json`
3. The page's own frontmatter
4. Auto-derived from the filename (title-cased) and `order: 999`

Each field resolves independently — a page can take its `order` from `_meta.json` while its `title` still comes from frontmatter, if `_meta.json` doesn't set a title for that key.

This means `_meta.json` is the right place to reorganize navigation without touching content files: renaming a sidebar label, reordering pages, or moving a page into a different category is a one-line change in `_meta.json`, no matter what the page's own frontmatter says.

## Category separators

Set `type: "separator"` to inject a non-clickable heading into the sidebar at a given position — useful for grouping pages under labels like **Getting Started** or **Guides** without those labels being real pages:

```json filename="content/_meta.json"
{
	"items": {
		"getting-started-heading": { "type": "separator", "title": "Getting Started", "order": 1 },
		"introduction": { "order": 2 },
		"getting-started": { "title": "Quick Start", "order": 3 },
		"guides-heading": { "type": "separator", "title": "Guides", "order": 4 },
		"writing-content": { "order": 5 }
	}
}
```

The separator's key (`getting-started-heading` above) doesn't need to match a real file — it only needs to be unique within that `items` map. Separators sort into the list by `order` exactly like real items, so they interleave naturally with the pages around them. This site's own sidebar is built this way — see `content/_meta.json` in this project.

## Folders

A folder's own title and order can be set from its _parent_ directory's `_meta.json`, keyed by the folder name:

```json filename="content/_meta.json"
{
	"items": {
		"deployment": { "title": "Deploy", "order": 6 }
	}
}
```

This only applies to folders that don't resolve to a real document (no `index.md`/`index.svx` inside them) — if the folder has an index page, that page's own title wins, since it's a real page with its own metadata.
