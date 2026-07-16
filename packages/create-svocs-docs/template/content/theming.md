## During setup

`create-svocs-docs` asks for an accent color when scaffolding a new site:

```txt
Accent color (hex): (#ff3c00) #2563eb
```

Leave it blank to keep the default ember orange, or type any hex color. Buttons, links, badges, the search dialog's focus ring, and the header glow all update to match.

## After setup

The whole palette lives in `src/routes/+layout.svelte`, in one `<style>` block with two sections: `:root[data-theme='dark']` and `:root[data-theme='light']`. Change `--accent` there any time:

```css filename="src/routes/+layout.svelte"
:root[data-theme='dark'] {
	--accent: #2563eb;
	/* ... */
}
```

`--accent-soft`, `--accent-strong`, and `--glow-a` (the ambient background glow) aren't independent colors. They're `color-mix()` expressions derived from `--accent`, so changing one line re-themes all of them together instead of leaving some pieces colored the old way.

## The rest of the palette

`--bg`, `--text`, `--line`, and friends are neutral tones (near-black/near-white grays) and stay independent of `--accent` on purpose: they're what make dark mode read as dark mode regardless of brand color. Adjust them directly if you want a cooler or warmer neutral base, but there's no derivation to keep in sync: each is its own literal value, dark and light set separately.
