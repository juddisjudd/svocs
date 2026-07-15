<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="file-tree">
	<ul>
		{@render children()}
	</ul>
</div>

<style>
	.file-tree {
		margin: 1.25rem 0;
		padding: 0.75rem 1rem;
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		background: var(--bg-soft);
		font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
		font-size: 0.85rem;
	}

	.file-tree ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.2rem;
	}

	.file-tree :global(ul ul) {
		margin-left: 0.9rem;
		padding-left: 0.75rem;
		border-left: 1px solid var(--line);
	}
</style>
