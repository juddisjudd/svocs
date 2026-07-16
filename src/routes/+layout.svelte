<script lang="ts">
	import logoMark from '$lib/assets/logo-mark.svg';
	import { resolve, base } from '$app/paths';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import SearchBox from '$lib/themes/docs/SearchBox.svelte';
	import SearchDialog from '$lib/themes/docs/search/SearchDialog.svelte';
	import ThemeToggle from '$lib/themes/docs/ThemeToggle.svelte';
	import { SITE_URL, SITE_NAME } from '$lib/site';

	let { children }: { children: Snippet } = $props();
	const repoUrl = 'https://github.com/juddisjudd/svocs';
	const currentPath = $derived(page.url.pathname.replace(/\/$/, '') || '/');

	// Every prerendered route gets a matching card from scripts/og/generate.mjs
	// (build/og/<route>.png), so the URL is derivable straight from the path.
	const ogImage = $derived(`${SITE_URL}/og${currentPath === '/' ? '/index' : currentPath}.png`);

	let searchDialog: ReturnType<typeof SearchDialog> | undefined = $state();

	function onWindowKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			searchDialog?.open();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={logoMark} />
	<link rel="icon" type="image/png" sizes="32x32" href="{base}/favicon-32x32.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="{base}/favicon-16x16.png" />
	<link rel="apple-touch-icon" href="{base}/apple-touch-icon.png" />

	<!-- Site-wide social preview defaults — individual pages set their own
	     og:title/og:description/og:url alongside their <title>, while the
	     image URL is derived from the route here in one place (SvelteKit
	     appends nested svelte:head content, it doesn't replace it). -->
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="{SITE_NAME} — Svelte-powered documentation framework" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

<a class="skip" href="#main-content">Skip to content</a>

<div class="app-shell">
	<header>
		<div class="topbar">
			<div class="topbar-left">
				<a class="brand" href={resolve('/')}>
					<img class="mark" src={logoMark} alt="" width="20" height="20" />
					<span><span class="brand-accent">SV</span><span class="brand-rest">OCS</span></span>
				</a>

				<nav class="primary-nav" aria-label="Primary">
					<a
						href={resolve('/showcase')}
						aria-current={currentPath === '/showcase' ? 'page' : undefined}
					>
						Showcase
					</a>
					<a
						href={resolve('/sponsors')}
						aria-current={currentPath === '/sponsors' ? 'page' : undefined}
					>
						Sponsors
					</a>
				</nav>
			</div>

			<div class="actions">
				<div class="search-wrap">
					<SearchBox onOpen={() => searchDialog?.open()} />
				</div>
				<ThemeToggle />
				<a
					class="repo"
					href={repoUrl}
					target="_blank"
					rel="noreferrer"
					aria-label="GitHub repository"
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path
							d="M12 2C6.477 2 2 6.596 2 12.266c0 4.536 2.865 8.385 6.839 9.743.5.096.683-.222.683-.494 0-.244-.009-.89-.014-1.747-2.782.617-3.37-1.38-3.37-1.38-.455-1.183-1.11-1.498-1.11-1.498-.908-.639.069-.626.069-.626 1.004.072 1.532 1.058 1.532 1.058.893 1.57 2.341 1.117 2.91.854.091-.667.35-1.118.636-1.374-2.221-.259-4.555-1.14-4.555-5.075 0-1.121.39-2.039 1.029-2.757-.103-.261-.446-1.312.098-2.735 0 0 .84-.276 2.75 1.053A9.35 9.35 0 0 1 12 6.877c.85.004 1.705.118 2.504.347 1.909-1.329 2.747-1.053 2.747-1.053.546 1.423.203 2.474.1 2.735.64.718 1.027 1.636 1.027 2.757 0 3.945-2.338 4.813-4.566 5.067.359.318.678.946.678 1.907 0 1.377-.012 2.487-.012 2.826 0 .274.18.594.688.493C19.137 20.647 22 16.8 22 12.266 22 6.596 17.523 2 12 2z"
						/>
					</svg>
				</a>
			</div>
		</div>
	</header>

	<SearchDialog bind:this={searchDialog} />

	<main id="main-content">
		{@render children()}
	</main>

	<footer>
		<div class="footer-wrap">
			<span>© {new Date().getFullYear()} SVOCS</span>
			<a class="footer-oss" href={repoUrl} target="_blank" rel="noreferrer">
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path
						d="M12 2C6.477 2 2 6.596 2 12.266c0 4.536 2.865 8.385 6.839 9.743.5.096.683-.222.683-.494 0-.244-.009-.89-.014-1.747-2.782.617-3.37-1.38-3.37-1.38-.455-1.183-1.11-1.498-1.11-1.498-.908-.639.069-.626.069-.626 1.004.072 1.532 1.058 1.532 1.058.893 1.57 2.341 1.117 2.91.854.091-.667.35-1.118.636-1.374-2.221-.259-4.555-1.14-4.555-5.075 0-1.121.39-2.039 1.029-2.757-.103-.261-.446-1.312.098-2.735 0 0 .84-.276 2.75 1.053A9.35 9.35 0 0 1 12 6.877c.85.004 1.705.118 2.504.347 1.909-1.329 2.747-1.053 2.747-1.053.546 1.423.203 2.474.1 2.735.64.718 1.027 1.636 1.027 2.757 0 3.945-2.338 4.813-4.566 5.067.359.318.678.946.678 1.907 0 1.377-.012 2.487-.012 2.826 0 .274.18.594.688.493C19.137 20.647 22 16.8 22 12.266 22 6.596 17.523 2 12 2z"
					/>
				</svg>
				Fully open-source on GitHub
			</a>
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
			<feTurbulence
				type="fractalNoise"
				baseFrequency="0.012"
				numOctaves="4"
				seed="7"
				result="noise"
			/>
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
					<animate
						attributeName="intercept"
						values="1;-16"
						dur="0.9s"
						begin="indefinite"
						fill="freeze"
					/>
				</feFuncA>
			</feComponentTransfer>
			<feComposite in="displaced" in2="threshold" operator="in" />
		</filter>
	</svg>
</div>

<style>
	/*
	 * Brand palette: ember #ff3c00 · blush #edc6bd · ink #070304
	 * Dark is the warm-black default; light is a dedicated porcelain/blush
	 * palette, not an inversion. Both are selected via data-theme on <html>.
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
		/* Derived from --accent so a custom accent produces a coordinated
		   ramp; keep --accent the only literal color here. */
		--accent-soft: color-mix(in srgb, var(--accent) 78%, white);
		--accent-strong: color-mix(in srgb, var(--accent) 60%, white);
		--accent-contrast: #180806;
		--danger: #ff7d6b;
		/* Prism token palette. Keywords ride the accent ramp so a custom accent
		   recolors code too; the rest are warm neutrals plus one cool contrast
		   (property/attr-name) so dense code stays scannable. */
		--code-comment: #857468;
		--code-keyword: var(--accent-soft);
		--code-string: #c8b482;
		--code-function: #e0af68;
		--code-number: #e39a86;
		--code-property: #8fb8b2;
		--code-punctuation: #8d7f77;
		--code-operator: #b3a49b;
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
		--code-comment: #97867c;
		--code-keyword: var(--accent-soft);
		--code-string: #8a6d2f;
		--code-function: #a05e14;
		--code-number: #ab4a30;
		--code-property: #33695f;
		--code-punctuation: #8d7f77;
		--code-operator: #6f6058;
		--glow-a: color-mix(in srgb, var(--accent) 15%, white);
		--glow-b: #efe7e2;
		--shadow-card:
			0 1px 2px rgba(52, 20, 8, 0.05), 0 4px 12px rgba(52, 20, 8, 0.07),
			inset 0 1px 0 rgba(255, 255, 255, 0.6);
		--shadow-lift: 0 1px 2px rgba(52, 20, 8, 0.06), 0 12px 32px rgba(52, 20, 8, 0.12);
		--shadow-bar: 0 8px 28px rgba(52, 20, 8, 0.08);
	}

	/* Theme-switch dissolve: the #svocs-dissolve filter disintegrates the old
	   page snapshot (ThemeToggle restarts its SMIL animations). This keyframe
	   holds the view transition open for the filter's duration — a transition
	   ends when its pseudo-element animations end — and degrades to a plain
	   fade if SMIL never fires. */
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

	.topbar-left {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		min-width: 0;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		text-decoration: none;
		font-weight: 700;
		letter-spacing: 0.03em;
		font-size: 0.98rem;
	}

	.brand-accent {
		color: var(--accent);
		font-weight: 900;
	}

	.brand-rest {
		color: var(--text);
	}

	.mark {
		width: 1.25rem;
		height: 1.25rem;
		filter: drop-shadow(0 0 10px color-mix(in srgb, var(--accent) 45%, transparent));
	}

	.primary-nav {
		display: flex;
		align-items: center;
		gap: 1.1rem;
	}

	.primary-nav a {
		text-decoration: none;
		color: var(--text-dim);
		font-size: 0.88rem;
		font-weight: 550;
		transition: color 120ms ease;
	}

	.primary-nav a:hover {
		color: var(--accent-soft);
	}

	.primary-nav a[aria-current='page'] {
		color: var(--accent-strong);
		font-weight: 700;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.search-wrap {
		width: min(11rem, 40vw);
	}

	.repo {
		width: 2.2rem;
		height: 2.2rem;
		display: grid;
		place-items: center;
		border-radius: 0.5rem;
		border: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg-soft) 88%, transparent);
		color: var(--text);
		transition: color 0.16s ease;
	}

	.repo:hover {
		color: var(--accent-soft);
	}

	.repo svg {
		width: 1.15rem;
		height: 1.15rem;
		fill: currentColor;
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

	.footer-oss {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		text-decoration: none;
		color: var(--text-dim);
		transition: color 120ms ease;
	}

	.footer-oss svg {
		width: 0.95rem;
		height: 0.95rem;
		fill: currentColor;
	}

	.footer-oss:hover {
		color: var(--accent-soft);
	}

	@media (max-width: 800px) {
		.primary-nav {
			display: none;
		}

		.footer-wrap {
			flex-direction: column;
		}
	}

	@media (max-width: 560px) {
		.topbar,
		.actions,
		.search-wrap {
			min-width: 0;
		}

		.search-wrap {
			width: 2.4rem;
		}
	}
</style>
