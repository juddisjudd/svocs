<script lang="ts">
	import logoMark from '$lib/assets/logo-mark.svg';
	import { resolve, base } from '$app/paths';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import SearchBox from '$lib/themes/docs/SearchBox.svelte';
	import ThemeToggle from '$lib/themes/docs/ThemeToggle.svelte';

	let { children }: { children: Snippet } = $props();
	const repoUrl = 'https://github.com/juddisjudd/svocs';
	const currentPath = $derived(page.url.pathname.replace(/\/$/, '') || '/');
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={logoMark} />
	<link rel="icon" type="image/png" sizes="32x32" href="{base}/favicon-32x32.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="{base}/favicon-16x16.png" />
	<link rel="apple-touch-icon" href="{base}/apple-touch-icon.png" />
</svelte:head>

<a class="skip" href="#main-content">Skip to content</a>

<div class="app-shell">
	<header>
		<div class="topbar">
			<div class="topbar-left">
				<a class="brand" href={resolve('/')}>
					<img class="mark" src={logoMark} alt="" width="20" height="20" />
					SVOCS
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
					<SearchBox compact />
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
		color: var(--text);
		font-weight: 700;
		letter-spacing: 0.03em;
		font-size: 0.98rem;
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
		width: min(26rem, 56vw);
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
		transition: transform 0.16s ease;
	}

	.repo:hover {
		color: var(--accent-soft);
		transform: translateY(-1px);
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

		.search-wrap {
			width: min(18rem, 52vw);
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
			width: min(10rem, 36vw);
		}
	}
</style>
