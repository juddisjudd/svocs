## During setup

`create-svocs-docs` asks for an accent color when scaffolding a new site:

```txt
Accent color (hex): (#ff3c00) #2563eb
```

Leave it blank to keep the default ember orange, or type any hex color (non-interactively, pass `--accent=#2563eb`). Buttons, links, badges, the search dialog's focus ring, and the header glow all update to match.

## After setup

The whole palette lives in `src/routes/+layout.svelte`, in one `<style>` block with two sections: `:root[data-theme='dark']` and `:root[data-theme='light']`. Change `--accent` there any time:

```css filename="src/routes/+layout.svelte"
:root[data-theme='dark'] {
	--accent: #2563eb;
	/* ... */
}
```

`--accent-soft`, `--accent-strong`, and `--glow-a` (the ambient background glow) aren't independent colors. They're `color-mix()` expressions derived from `--accent`:

```css
--accent-soft: color-mix(in srgb, var(--accent) 78%, white);
--accent-strong: color-mix(in srgb, var(--accent) 60%, white);
--glow-a: color-mix(in srgb, var(--accent) 10%, black);
```

Changing that one line re-themes all of them together, so a custom accent never leaves the ambient glow stuck on the default orange.

## The rest of the palette

`--bg`, `--text`, `--line`, and friends are neutral tones (near-black/near-white grays) and stay independent of `--accent` on purpose: they're what make dark mode read as dark mode regardless of brand color. Adjust them directly if you want a cooler or warmer neutral base. There's no derivation to keep in sync there; each is its own literal value, dark and light set separately.

## Reading a `color-mix()` custom property from JS

If you're building something that needs the _resolved_ color (a canvas/WebGL effect, for instance), `getComputedStyle(document.documentElement).getPropertyValue('--accent-soft')` returns the literal `color-mix(...)` text, not a computed color. Resolve it by assigning the var to a real CSS property on a probe element and reading that back:

```js
const probe = document.createElement('div');
document.body.appendChild(probe);
probe.style.color = 'var(--accent-soft)';
getComputedStyle(probe).color; // "color(srgb 1 0.42 0.22)" or "rgb(255, 106, 56)"
```

Note the two possible output formats: a `color-mix()` result serializes as `color(srgb r g b)` (already 0–1 normalized) in Chromium, while a plain literal serializes as legacy `rgb(r, g, b)` (0–255). Code that consumes this needs to branch on which one it got.
