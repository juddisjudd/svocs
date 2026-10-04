<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { withoutBase } from '#lib/core/base-path.js';
	import { getPageTreeSiblings, type PageMapNode } from '#lib/core/page-map.js';
	import { DOCS_PAGE_MAP_CONTEXT } from '#lib/core/page-map-context.js';
	import Card from './Card.svelte';

	let { auto = false, children }: { auto?: boolean; children?: Snippet } = $props();

	const getPageMap = getContext<(() => PageMapNode[]) | undefined>(DOCS_PAGE_MAP_CONTEXT);

	// /docs itself renders the introduction document under the hood (see
	// docs/+page.ts), so sibling lookups need the same substitution the
	// pager in docs/+layout.svelte uses. The base path is stripped so the
	// lookup matches page-map paths when BASE_PATH is set.
	const pathname = $derived(withoutBase(page.url).replace(/\/$/, '') || '/docs');
	const currentPath = $derived(pathname === '/docs' ? '/docs/introduction' : pathname);
	const siblings = $derived(
		auto && getPageMap ? getPageTreeSiblings(getPageMap(), currentPath) : []
	);
</script>

<div class="cards">
	{#if auto}
		{#each siblings as sibling (sibling.path)}
			<Card
				title={sibling.title}
				href={sibling.slug ? resolve('/docs/[...slug]', { slug: sibling.slug }) : resolve('/docs')}
				icon={sibling.icon}
			>
				{sibling.description}
			</Card>
		{/each}
	{:else}
		{@render children?.()}
	{/if}
</div>

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.75rem;
		margin: 1.25rem 0;
	}
</style>
