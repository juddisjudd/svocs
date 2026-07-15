<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		open = false,
		children
	}: { title: string; open?: boolean; children: Snippet } = $props();
</script>

<details class="collapse" {open}>
	<summary>
		<svg class="chevron" viewBox="0 0 16 16" aria-hidden="true">
			<path
				d="m6 4 4 4-4 4"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		{title}
	</summary>
	<div class="content">
		{@render children()}
	</div>
</details>

<style>
	.collapse {
		margin: 1rem 0;
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		background: var(--bg-soft);
		overflow: hidden;
	}

	summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 0.9rem;
		font-weight: 600;
		font-size: 0.92rem;
		color: var(--text);
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.chevron {
		width: 0.85rem;
		height: 0.85rem;
		flex-shrink: 0;
		color: var(--text-dim);
		transition: transform 160ms ease;
	}

	.collapse[open] .chevron {
		transform: rotate(90deg);
	}

	.content {
		padding: 0 0.9rem 0.9rem;
		font-size: 0.92rem;
		color: var(--text-soft);
	}

	.content :global(p:first-child) {
		margin-top: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition-duration: 0.01ms;
		}
	}
</style>
