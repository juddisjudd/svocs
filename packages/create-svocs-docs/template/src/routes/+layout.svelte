<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import SearchBox from '$lib/themes/docs/SearchBox.svelte';
	import ThemeToggle from '$lib/themes/docs/ThemeToggle.svelte';
	import { SITE_NAME } from '$lib/site';

	let { children }: { children: Snippet } = $props();
</script>

<a class="skip" href="#main-content">Skip to content</a>

<div class="app-shell">
	<header>
		<div class="topbar">
			<a class="brand" href={resolve('/')}>
				{SITE_NAME}
			</a>

			<div class="actions">
				<div class="search-wrap">
					<SearchBox compact />
				</div>
				<ThemeToggle />
			</div>
		</div>
	</header>

	<main id="main-content">
		{@render children()}
	</main>

	<footer>
		<div class="footer-wrap">
			<span>© {new Date().getFullYear()} {SITE_NAME}</span>
			<a class="footer-link" href={resolve('/docs')}>Docs</a>
		</div>
	</footer>
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
		--accent-soft: #ff6a38;
		--accent-strong: #ff9066;
		--accent-contrast: #180806;
		--danger: #ff7d6b;
		--glow-a: #140903;
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
		--accent-soft: #e83500;
		--accent-strong: #c22e00;
		--accent-contrast: #180806;
		--danger: #b8321c;
		--glow-a: #f9e2d7;
		--glow-b: #efe7e2;
		--shadow-card:
			0 1px 2px rgba(52, 20, 8, 0.05), 0 4px 12px rgba(52, 20, 8, 0.07),
			inset 0 1px 0 rgba(255, 255, 255, 0.6);
		--shadow-lift: 0 1px 2px rgba(52, 20, 8, 0.06), 0 12px 32px rgba(52, 20, 8, 0.12);
		--shadow-bar: 0 8px 28px rgba(52, 20, 8, 0.08);
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
		width: min(26rem, 56vw);
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
			width: min(10rem, 36vw);
		}
	}
</style>
