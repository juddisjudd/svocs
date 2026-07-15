<script lang="ts">
	import { getContext } from 'svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const tabs = getContext<{ isActive: (i: number) => boolean; register: () => number }>('tabs');
	const index = tabs.register();
</script>

{#if tabs.isActive(index)}
	<div class="tab-panel" role="tabpanel">
		{@render children()}
	</div>
{/if}

<style>
	.tab-panel :global(p:first-child) {
		margin-top: 0;
	}

	.tab-panel :global(p:last-child) {
		margin-bottom: 0;
	}
</style>
