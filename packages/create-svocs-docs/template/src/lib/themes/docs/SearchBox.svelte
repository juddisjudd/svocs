<script lang="ts">
	let { onOpen }: { onOpen: () => void } = $props();
</script>

<button type="button" class="search-trigger" onclick={onOpen} aria-label="Search documentation">
	<svg viewBox="0 0 16 16" aria-hidden="true">
		<circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
		<path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
	</svg>
	<span>Search docs</span>
	<kbd>⌘K</kbd>
</button>

<style>
	.search-trigger {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 0.65rem;
		border-radius: 0.5rem;
		border: 1px solid transparent;
		background: color-mix(in srgb, var(--bg-soft) 55%, transparent);
		color: var(--text-soft);
		cursor: pointer;
		/* Dim at rest, full brightness on hover/focus — no border or outline
		   ring, matching the site-wide "shift opacity, not border" treatment. */
		opacity: 0.7;
		transition:
			opacity 0.18s ease,
			background-color 0.18s ease,
			color 0.18s ease;
	}

	.search-trigger:hover,
	.search-trigger:focus-visible {
		opacity: 1;
		background: color-mix(in srgb, var(--bg-soft) 92%, transparent);
		color: var(--text);
		outline: none;
	}

	.search-trigger svg {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.search-trigger span {
		flex: 1;
		text-align: left;
		font-size: 0.88rem;
	}

	.search-trigger kbd {
		font-family: inherit;
		font-size: 0.72rem;
		color: var(--text-dim);
		padding: 0.1rem 0.4rem;
		border-radius: 0.35rem;
		border: 1px solid var(--line-strong);
		background: var(--bg-soft-2);
		flex-shrink: 0;
	}

	@media (max-width: 560px) {
		.search-trigger span {
			display: none;
		}

		.search-trigger kbd {
			display: none;
		}
	}
</style>
