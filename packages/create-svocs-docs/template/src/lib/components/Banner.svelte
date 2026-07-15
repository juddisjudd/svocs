<script lang="ts">
	import type { Snippet } from 'svelte';

	let { id, children }: { id: string; children: Snippet } = $props();

	// `id` is a stable identity for this banner instance, not something that
	// should re-trigger dismissal state if it ever changed — read once.
	let dismissed = $state(
		typeof localStorage !== 'undefined' && localStorage.getItem(`docs-banner-${id}`) === '1'
	);

	function dismiss() {
		dismissed = true;
		try {
			localStorage.setItem(`docs-banner-${id}`, '1');
		} catch {
			// storage unavailable — banner still dismisses for this page view
		}
	}
</script>

{#if !dismissed}
	<div class="banner">
		<div class="content">
			{@render children()}
		</div>
		<button type="button" class="dismiss" onclick={dismiss} aria-label="Dismiss">
			<svg viewBox="0 0 16 16" aria-hidden="true">
				<path
					d="m4 4 8 8m0-8-8 8"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</div>
{/if}

<style>
	.banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin: 0 0 1.25rem;
		padding: 0.65rem 1rem;
		border-radius: 0.6rem;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line));
		background: color-mix(in srgb, var(--accent) 8%, var(--bg-soft));
		font-size: 0.88rem;
		color: var(--text-soft);
	}

	.content :global(p) {
		margin: 0;
	}

	.content :global(a) {
		color: var(--accent-strong);
	}

	.dismiss {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		border: none;
		border-radius: 0.4rem;
		background: transparent;
		color: var(--text-dim);
		cursor: pointer;
	}

	.dismiss:hover {
		color: var(--text);
	}

	.dismiss svg {
		width: 0.8rem;
		height: 0.8rem;
	}
</style>
