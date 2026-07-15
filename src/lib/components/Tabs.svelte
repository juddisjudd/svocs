<script lang="ts">
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';

	let { items, children }: { items: string[]; children: Snippet } = $props();

	let active = $state(0);
	// Tab panels register themselves in document order on first render so
	// authors don't need to pass an explicit index to each <Tab>.
	const registry = { next: 0 };

	setContext('tabs', {
		isActive: (index: number) => active === index,
		register: () => registry.next++
	});
</script>

<div class="tabs">
	<div class="tabs-list" role="tablist">
		{#each items as item, i (item)}
			<button
				type="button"
				role="tab"
				class="tab-label"
				class:active={active === i}
				aria-selected={active === i}
				onclick={() => (active = i)}
			>
				{item}
			</button>
		{/each}
	</div>
	<div class="tabs-panels">
		{@render children()}
	</div>
</div>

<style>
	.tabs {
		margin: 1.25rem 0;
	}

	.tabs-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		border-bottom: 1px solid var(--line);
	}

	.tab-label {
		padding: 0.5rem 0.9rem;
		border: none;
		border-bottom: 2px solid transparent;
		background: transparent;
		font: inherit;
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--text-dim);
		cursor: pointer;
		transition:
			color 120ms ease,
			border-color 120ms ease;
	}

	.tab-label:hover {
		color: var(--text);
	}

	.tab-label.active {
		color: var(--accent-strong);
		border-color: var(--accent);
	}

	.tabs-panels {
		padding-top: 0.9rem;
	}
</style>
