<script lang="ts">
	import type { PageMapNode } from '$lib/core/page-map';
	import SidebarItem from './SidebarItem.svelte';

	let {
		nodes,
		currentPath,
		onNavigate,
		depth = 0
	}: {
		nodes: PageMapNode[];
		currentPath: string;
		onNavigate: () => void;
		depth?: number;
	} = $props();
</script>

<ul class:nested={depth > 0}>
	{#each nodes as node (node.path)}
		<SidebarItem {node} {currentPath} {onNavigate} {depth} />
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.15rem;
	}

	/* nested levels get a guide line instead of floating whitespace */
	ul.nested {
		margin: 0.15rem 0 0.25rem 0.75rem;
		padding-left: 0.5rem;
		border-left: 1px solid var(--line);
	}
</style>
