<script lang="ts">
	import type { PageData } from './$types';
	import { formatLastUpdated, getDocComponentBySlug } from '$lib/core/content';
	import PageActions from '$lib/themes/docs/PageActions.svelte';

	let { data }: { data: PageData } = $props();
	const Content = $derived(getDocComponentBySlug(data.entry.slug.split('/')));
</script>

<svelte:head>
	<title>{data.entry.title} | __SITE_NAME__</title>
	{#if data.entry.description}
		<meta name="description" content={data.entry.description} />
	{/if}
</svelte:head>

<article>
	<header>
		<h1>{data.entry.title}</h1>
		{#if data.entry.description}
			<p>{data.entry.description}</p>
		{/if}
		<p class="meta">{data.entry.readingTimeMinutes} min read · {data.entry.wordCount} words</p>
		<PageActions slug={data.entry.slug} />
	</header>

	{#if Content}
		<Content />
	{:else}
		<p>Unable to render this document component.</p>
	{/if}

	{#if data.entry.lastModified}
		<footer class="doc-colophon">
			Last updated on {formatLastUpdated(data.entry.lastModified)}
		</footer>
	{/if}
</article>

<style>
	header {
		margin-bottom: 1.75rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.9rem, 3.4vw, 2.5rem);
		letter-spacing: -0.02em;
		line-height: 1.15;
	}

	header p {
		margin: 0.6rem 0 0;
		color: var(--text-soft);
		font-size: 1.05rem;
	}

	.meta {
		font-size: 0.82rem;
		color: var(--text-dim);
	}

	.doc-colophon {
		margin-top: 3rem;
		padding-top: 1rem;
		border-top: 1px solid var(--line);
		font-size: 0.8rem;
		color: var(--text-dim);
		text-align: right;
	}
</style>
