<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import SearchBox from '$lib/themes/docs/SearchBox.svelte';
	import SearchDialog from '$lib/themes/docs/search/SearchDialog.svelte';
	import ThemeToggle from '$lib/themes/docs/ThemeToggle.svelte';
	import { SITE_NAME } from '$lib/site';

	let { children }: { children: Snippet } = $props();

	let searchDialog: ReturnType<typeof SearchDialog> | undefined = $state();

	function onWindowKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			searchDialog?.open();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<a class="skip" href="#main-content">Skip to content</a>

<div class="app-shell">
	<header>
		<div class="topbar">
			<a class="brand" href={resolve('/')}>
				{SITE_NAME}
			</a>

			<div class="actions">
				<div class="search-wrap">
					<SearchBox onOpen={() => searchDialog?.open()} />
				</div>
				<ThemeToggle />
			</div>
		</div>
	</header>

	<SearchDialog bind:this={searchDialog} />

	<main id="main-content">
		{@render children()}
	</main>

	<footer>
		<div class="footer-wrap">
			<span>© {new Date().getFullYear()} {SITE_NAME}</span>
			<a class="footer-link" href={resolve('/docs')}>Docs</a>
		</div>
	</footer>

	<!-- Filter behind the theme-switch dissolve; see the ::view-transition rules in the styles. -->
	<svg class="dissolve-defs" width="0" height="0" aria-hidden="true" focusable="false">
		<filter
			id="svocs-dissolve"
			x="-15%"
			y="-15%"
			width="130%"
			height="130%"
			color-interpolation-filters="sRGB"
		>
			<feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="7" result="noise" />
			<feDisplacementMap
				in="SourceGraphic"
				in2="noise"
				xChannelSelector="R"
				yChannelSelector="G"
				scale="0"
				result="displaced"
			>
				<animate attributeName="scale" values="0;90" dur="0.9s" begin="indefinite" fill="freeze" />
			</feDisplacementMap>
			<feColorMatrix
				in="noise"
				type="matrix"
				values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0"
				result="alpha-noise"
			/>
			<feComponentTransfer in="alpha-noise" result="threshold">
				<feFuncA type="linear" slope="16" intercept="1">
					<animate attributeName="intercept" values="1;-16" dur="0.9s" begin="indefinite" fill="freeze" />
				</feFuncA>
			</feComponentTransfer>
			<feComposite in="displaced" in2="threshold" operator="in" />
		</filter>
	</svg>
</div>

<style>
	/*
	 * Default theme tokens shipped by SVOCS. Adjust freely — every color used
	 * across the docs UI reads from these custom properties.
	 */
	:global(:root),
	:global(:root[data-theme='dark']) {
		color-scheme: dark;
		--bg: #070304;
		--bg-elev: #121011;
		--bg-soft: #1c1919;
		--bg-soft-2: #262221;
		--text: #f5f1ef;
		--text-soft: #d9cdc7;
		--text-dim: #a09189;
		--muted: #a89890;
		--line: #2a2523;
		--line-strong: #3d3532;
		--accent: #ff3c00;
		/* Soft/strong and the ambient glow tint derive from --accent rather
		   than shipping as independent hex values, so picking a different
		   accent color during `create-svocs-docs` setup (or hand-editing
		   this one line) always produces a coordinated ramp instead of
		   leaving the glow stuck looking ember-colored regardless of what
		   accent is picked. */
		--accent-soft: color-mix(in srgb, var(--accent) 78%, white);
		--accent-strong: color-mix(in srgb, var(--accent) 60%, white);
		--accent-contrast: #180806;
		--danger: #ff7d6b;
		--glow-a: color-mix(in srgb, var(--accent) 10%, black);
		--glow-b: #0e0c0c;
		--shadow-card:
			0 1px 2px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.22),
			inset 0 1px 0 rgba(255, 255, 255, 0.035);
		--shadow-lift: 0 1px 2px rgba(0, 0, 0, 0.25), 0 12px 32px rgba(0, 0, 0, 0.38);
		--shadow-bar: 0 8px 28px rgba(0, 0, 0, 0.35);
	}

	:global(:root[data-theme='light']) {
		color-scheme: light;
		--bg: #f8f4f2;
		--bg-elev: #fffdfc;
		--bg-soft: #f0e9e5;
		--bg-soft-2: #e7dcd6;
		--text: #140a06;
		--text-soft: #514540;
		--text-dim: #7d6e66;
		--muted: #87766d;
		--line: #e3d8d2;
		--line-strong: #cfc0b8;
		--accent: #ff3c00;
		--accent-soft: color-mix(in srgb, var(--accent) 91%, black);
		--accent-strong: color-mix(in srgb, var(--accent) 76%, black);
		--accent-contrast: #180806;
		--danger: #b8321c;
		--glow-a: color-mix(in srgb, var(--accent) 15%, white);
		--glow-b: #efe7e2;
		--shadow-card:
			0 1px 2px rgba(52, 20, 8, 0.05), 0 4px 12px rgba(52, 20, 8, 0.07),
			inset 0 1px 0 rgba(255, 255, 255, 0.6);
		--shadow-lift: 0 1px 2px rgba(52, 20, 8, 0.06), 0 12px 32px rgba(52, 20, 8, 0.12);
		--shadow-bar: 0 8px 28px rgba(52, 20, 8, 0.08);
	}

	/*
	 * Theme-switch dissolve transition. ThemeToggle wraps the data-theme flip
	 * in document.startViewTransition() and then restarts the SMIL animations
	 * inside the #svocs-dissolve SVG filter declared in this layout's markup.
	 * That filter disintegrates the OLD page snapshot: one feTurbulence
	 * (Perlin) noise field drives both a growing feDisplacementMap warp and a
	 * sweeping alpha threshold, so pixels smear and drop out in noise order
	 * everywhere at once instead of wiping across the screen. The keyframe
	 * below exists to hold the view transition open for the filter's duration
	 * (a view transition ends when its pseudo-element animations end) and to
	 * mop up the last specks with a late fade; if SMIL never fires, the
	 * effect degrades to that plain fade. Reduced-motion users never enter a
	 * view transition at all (guarded in ThemeToggle).
	 */
	@keyframes -global-svocs-burn-away {
		0%,
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	:global(::view-transition-old(root)) {
		/* Old snapshot must sit on top of (and dissolve to reveal) the new one. */
		z-index: 1;
		mix-blend-mode: normal;
		animation: svocs-burn-away 0.9s ease-in both;
		filter: url(#svocs-dissolve);
	}

	:global(::view-transition-new(root)) {
		mix-blend-mode: normal;
		animation: none;
	}

	.dissolve-defs {
		position: absolute;
		width: 0;
		height: 0;
	}

	:global(body) {
		margin: 0;
		font-family:
			'Satoshi', 'Aptos', 'Segoe UI Variable Text', 'Segoe UI', 'Trebuchet MS', sans-serif;
		background:
			radial-gradient(1200px 550px at 8% -12%, var(--glow-a) 0%, transparent 58%),
			radial-gradient(1000px 620px at 95% -10%, var(--glow-b) 0%, transparent 60%), var(--bg);
		color: var(--text);
		line-height: 1.55;
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(a:focus-visible),
	:global(button:focus-visible),
	:global(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	:global(::selection) {
		background: color-mix(in srgb, var(--accent) 32%, transparent);
	}

	.skip {
		position: absolute;
		left: -9999px;
	}

	.skip:focus {
		left: 1rem;
		top: 1rem;
		z-index: 20;
		background: var(--accent);
		color: var(--accent-contrast);
		padding: 0.4rem 0.6rem;
		border-radius: 0.4rem;
	}

	.app-shell {
		min-height: 100vh;
		display: grid;
		grid-template-rows: auto 1fr auto;
	}

	header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: color-mix(in srgb, var(--bg) 78%, transparent);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--line-strong);
		box-shadow: var(--shadow-bar);
	}

	.topbar {
		padding: 0.65rem 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.brand {
		text-decoration: none;
		color: var(--text);
		font-weight: 700;
		letter-spacing: 0.03em;
		font-size: 0.98rem;
		flex-shrink: 0;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.search-wrap {
		width: min(11rem, 40vw);
	}

	main {
		width: 100%;
	}

	footer {
		border-top: 1px solid var(--line-strong);
		padding: 1rem;
		background: color-mix(in srgb, var(--bg) 78%, transparent);
	}

	.footer-wrap {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.82rem;
		color: var(--text-dim);
	}

	.footer-link {
		text-decoration: none;
		color: var(--text-dim);
		transition: color 120ms ease;
	}

	.footer-link:hover {
		color: var(--accent-soft);
	}

	@media (max-width: 560px) {
		.search-wrap {
			width: 2.4rem;
		}
	}
</style>
