<script lang="ts">
	import { browser } from '$app/environment';
	import { tick } from 'svelte';

	type Theme = 'dark' | 'light';

	let theme = $state<Theme>(
		browser && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
	);

	function applyTheme(next: Theme) {
		theme = next;
		document.documentElement.dataset.theme = next;
		try {
			localStorage.setItem('svocs-theme', next);
		} catch {
			// storage unavailable — theme still applies for this page view
		}
	}

	function toggle() {
		const next: Theme = theme === 'dark' ? 'light' : 'dark';
		// The dissolve effect (see the ::view-transition rules and the
		// #svocs-dissolve filter in +layout.svelte) only runs when the browser
		// supports view transitions and the user hasn't asked for reduced
		// motion; otherwise the switch stays instant.
		if (
			!document.startViewTransition ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			applyTheme(next);
			return;
		}
		const transition = document.startViewTransition(async () => {
			applyTheme(next);
			await tick();
		});
		// The filter's SMIL animations are parked at begin="indefinite" and can
		// only start once the snapshot pseudo-elements exist, hence the ready
		// hook. A fresh turbulence seed keeps repeated toggles from dissolving
		// in the identical pattern.
		transition.ready
			.then(() => {
				document
					.querySelector('#svocs-dissolve feTurbulence')
					?.setAttribute('seed', String(Math.floor(Math.random() * 1000)));
				for (const anim of document.querySelectorAll<SVGAnimateElement>(
					'#svocs-dissolve animate'
				)) {
					anim.beginElement();
				}
			})
			.catch(() => {
				// transition was skipped — theme is applied either way
			});
	}
</script>

<button
	type="button"
	onclick={toggle}
	aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
>
	{#if theme === 'dark'}
		<!-- moon -->
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<path
				d="M13.4 9.9A5.6 5.6 0 0 1 6.1 2.6 5.6 5.6 0 1 0 13.4 9.9Z"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linejoin="round"
			/>
		</svg>
	{:else}
		<!-- sun -->
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<circle cx="8" cy="8" r="3.1" fill="none" stroke="currentColor" stroke-width="1.4" />
			<path
				d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linecap="round"
			/>
		</svg>
	{/if}
</button>

<style>
	button {
		width: 2.2rem;
		height: 2.2rem;
		display: grid;
		place-items: center;
		border-radius: 0.5rem;
		border: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg-soft) 88%, transparent);
		color: var(--text);
		cursor: pointer;
		transition:
			transform 0.16s ease,
			color 0.16s ease;
	}

	button:active {
		transform: scale(0.94);
	}

	@media (hover: hover) and (pointer: fine) {
		button:hover {
			color: var(--accent-soft);
		}
	}

	svg {
		width: 1.05rem;
		height: 1.05rem;
	}
</style>
