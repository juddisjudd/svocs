<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getBreadcrumbsByPath, type PageMapNode } from '$lib/core/page-map';
	import SidebarTree from '$lib/themes/docs/SidebarTree.svelte';
	import { enhanceCodeBlocks } from '$lib/themes/docs/code-blocks';
	import { observeHeadings } from '$lib/themes/docs/scroll-spy';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	let sidebarOpen = $state(false);
	let navCollapsed = $state(browser && localStorage.getItem('svocs-nav') === 'collapsed');
	let proseEl: HTMLDivElement | undefined = $state();
	let activeHeadingId: string | undefined = $state();

	function closeSidebar() {
		sidebarOpen = false;
	}

	function toggleNav() {
		navCollapsed = !navCollapsed;
		try {
			localStorage.setItem('svocs-nav', navCollapsed ? 'collapsed' : 'open');
		} catch {
			// storage unavailable — collapse still applies for this page view
		}
	}

	const currentPath = $derived(page.url.pathname.replace(/\/$/, '') || '/docs');
	const breadcrumbs = $derived(getBreadcrumbsByPath(currentPath, data.pageMap));

	type TocItem = { id: string; text: string; depth: number };
	const toc = $derived((page.data.toc ?? []) as TocItem[]);
	const activeTocIndex = $derived(toc.findIndex((item) => item.id === activeHeadingId));
	const tocProgress = $derived(
		activeTocIndex > 0 && toc.length > 1 ? (activeTocIndex / (toc.length - 1)) * 100 : 0
	);

	// Re-scan for un-enhanced code blocks and re-attach the TOC scroll-spy
	// whenever navigation swaps in a new doc page's static markup.
	$effect(() => {
		void currentPath;
		enhanceCodeBlocks(proseEl ?? null);
		return observeHeadings(
			proseEl ?? null,
			toc.map((item) => item.id),
			(id) => (activeHeadingId = id ?? undefined)
		);
	});

	type PagerLink = { title: string; path: string; slug: string };

	function flattenDocs(nodes: PageMapNode[]): PagerLink[] {
		const out: PagerLink[] = [];
		const walk = (list: PageMapNode[]) => {
			for (const node of list) {
				if (node.kind !== 'page') {
					continue;
				}
				if (node.isDocument) {
					out.push({ title: node.title, path: node.path, slug: node.slug });
				}
				walk(node.children);
			}
		};
		walk(nodes);
		return out;
	}

	const flatDocs = $derived(flattenDocs(data.pageMap));
	// /docs renders the getting-started document, so page through as that entry
	const pagerPath = $derived(currentPath === '/docs' ? '/docs/getting-started' : currentPath);
	const pagerIndex = $derived(flatDocs.findIndex((node) => node.path === pagerPath));
	const prevDoc = $derived(pagerIndex > 0 ? flatDocs[pagerIndex - 1] : null);
	const nextDoc = $derived(
		pagerIndex >= 0 && pagerIndex < flatDocs.length - 1 ? flatDocs[pagerIndex + 1] : null
	);
</script>

<div class="docs-layout" class:nav-collapsed={navCollapsed}>
	<button
		class="mobile-toggle"
		type="button"
		aria-expanded={sidebarOpen}
		onclick={() => (sidebarOpen = !sidebarOpen)}
	>
		{sidebarOpen ? 'Close menu' : 'Menu'}
	</button>

	<aside class:open={sidebarOpen}>
		<nav aria-label="Documentation navigation">
			<SidebarTree nodes={data.pageMap} {currentPath} onNavigate={closeSidebar} />
		</nav>
		<button
			class="rail-toggle"
			type="button"
			aria-expanded={!navCollapsed}
			aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			onclick={toggleNav}
		>
			{#if navCollapsed}
				<!-- layout-sidebar-left-expand (Tabler) -->
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path
						d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12"
					/>
					<path d="M9 4v16" />
					<path d="M14 10l2 2l-2 2" />
				</svg>
			{:else}
				<!-- layout-sidebar-left-collapse (Tabler) -->
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path
						d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12"
					/>
					<path d="M9 4v16" />
					<path d="M15 10l-2 2l2 2" />
				</svg>
			{/if}
		</button>
	</aside>

	<div class="doc-col">
		{#if breadcrumbs.length > 0}
			<nav class="breadcrumbs" aria-label="Breadcrumb">
				<ol>
					{#each breadcrumbs as crumb (crumb.path)}
						<li>
							<a
								href={crumb.path === '/docs'
									? resolve('/docs')
									: resolve('/docs/[...slug]', { slug: crumb.path.replace('/docs/', '') })}
								aria-current={crumb.path === currentPath ? 'page' : undefined}
							>
								{crumb.title}
							</a>
						</li>
					{/each}
				</ol>
			</nav>
		{/if}

		<div class="prose" bind:this={proseEl}>
			{@render children()}
		</div>

		{#if prevDoc || nextDoc}
			<nav class="pager" aria-label="Pagination">
				{#if prevDoc}
					<a class="prev" href={resolve('/docs/[...slug]', { slug: prevDoc.slug })}>
						<span aria-hidden="true">←</span>
						{prevDoc.title}
					</a>
				{:else}
					<span></span>
				{/if}
				{#if nextDoc}
					<a class="next" href={resolve('/docs/[...slug]', { slug: nextDoc.slug })}>
						{nextDoc.title}
						<span aria-hidden="true">→</span>
					</a>
				{/if}
			</nav>
		{/if}
	</div>

	<nav class="toc-rail" aria-label="Table of contents">
		{#if toc.length > 0}
			<p class="toc-title">
				<svg viewBox="0 0 16 16" aria-hidden="true">
					<path
						d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7"
						fill="none"
						stroke="currentColor"
						stroke-width="1.4"
						stroke-linecap="round"
					/>
				</svg>
				On this page
			</p>
			<ul style:--toc-progress="{tocProgress}%">
				{#each toc as item, i (item.id)}
					<li
						class:depth3={item.depth === 3}
						class:read={activeTocIndex >= 0 && i <= activeTocIndex}
						class:active={i === activeTocIndex}
					>
						<a href={`#${item.id}`} aria-current={i === activeTocIndex ? 'true' : undefined}>
							{item.text}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</nav>
</div>

<style>
	.docs-layout {
		display: grid;
		grid-template-columns: 16rem minmax(0, 1fr) 13rem;
		padding: 0 1rem;
		transition: grid-template-columns 220ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.docs-layout.nav-collapsed {
		grid-template-columns: 2.6rem minmax(0, 1fr) 13rem;
	}

	.mobile-toggle {
		display: none;
	}

	/* ---- sidebar ---- */

	aside {
		position: sticky;
		top: 3.6rem;
		height: calc(100vh - 3.6rem);
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--line);
		overflow: hidden;
	}

	aside nav {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem 0.75rem 1rem 0;
	}

	.nav-collapsed aside nav {
		display: none;
	}

	.rail-toggle {
		/* margin-top: auto keeps the button pinned bottom-left even when the
		   nav above it is hidden in the collapsed state */
		margin-top: auto;
		align-self: flex-start;
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		margin-bottom: 1rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 0.45rem;
		background: transparent;
		color: var(--text-dim);
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}

	.rail-toggle:hover {
		color: var(--accent-soft);
	}

	.rail-toggle svg {
		width: 1.1rem;
		height: 1.1rem;
	}

	/* ---- content column ---- */

	.doc-col {
		min-width: 0;
		max-width: 50rem;
		width: 100%;
		margin: 0 auto;
		padding: 1.75rem 3rem 4rem;
	}

	.breadcrumbs {
		margin-bottom: 1.25rem;
	}

	.breadcrumbs ol {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		font-size: 0.83rem;
	}

	.breadcrumbs li {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.breadcrumbs li:not(:last-child)::after {
		content: '/';
		color: var(--line-strong);
	}

	.breadcrumbs a {
		text-decoration: none;
		color: var(--text-dim);
		transition: color 120ms ease;
	}

	.breadcrumbs a:hover {
		color: var(--text);
	}

	.breadcrumbs a[aria-current='page'] {
		color: var(--text);
		font-weight: 600;
	}

	/* ---- shared prose styles for doc pages ---- */

	.prose :global(h2),
	.prose :global(h3) {
		scroll-margin-top: 5rem;
	}

	.prose :global(code) {
		font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
		font-size: 0.9em;
	}

	.prose :global(:not(pre) > code) {
		padding: 0.12em 0.35em;
		border-radius: 0.3em;
		background: var(--bg-soft);
		border: 1px solid var(--line);
		/* Long unbroken tokens (env var assignments, provider class paths)
		   have no whitespace to wrap at — without this they overflow their
		   container instead of breaking, dragging the whole page into
		   horizontal scroll at narrow widths. */
		overflow-wrap: break-word;
	}

	.prose :global(.heading-anchor) {
		margin-left: 0.35rem;
		text-decoration: none;
		opacity: 0;
		color: var(--accent-strong);
		transition: opacity 120ms ease;
	}

	.prose :global(h2:hover .heading-anchor),
	.prose :global(h3:hover .heading-anchor),
	.prose :global(.heading-anchor:focus-visible) {
		opacity: 1;
	}

	.prose :global(p),
	.prose :global(li) {
		color: var(--text-soft);
		line-height: 1.7;
	}

	.prose :global(a) {
		color: var(--accent-strong);
		text-decoration-color: color-mix(in srgb, var(--accent-strong) 45%, transparent);
	}

	.prose :global(a:hover) {
		color: var(--accent-soft);
		text-decoration-color: currentColor;
	}

	/* code-frame / code-frame-header / code-frame-body / code-copy are
	   injected client-side by enhanceCodeBlocks() around each prerendered
	   <pre>, so they need :global — Svelte's scoping can't reach markup it
	   didn't render. */
	.prose :global(.code-frame) {
		margin: 1rem 0;
		border: 1px solid var(--line);
		border-radius: 0.65rem;
		overflow: hidden;
		background: var(--bg-soft);
	}

	.prose :global(.code-frame-header) {
		padding: 0.5rem 0.9rem;
		font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
		font-size: 0.78rem;
		color: var(--text-dim);
		border-bottom: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg-soft-2) 60%, transparent);
	}

	.prose :global(.code-frame-body) {
		position: relative;
	}

	.prose :global(.code-frame-body pre) {
		margin: 0;
		border: none;
		border-radius: 0;
		background: transparent;
		padding: 0.9rem 1rem;
		padding-right: 3rem;
		overflow: auto;
	}

	.prose :global(.code-copy) {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		display: grid;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		background: color-mix(in srgb, var(--bg-elev) 85%, transparent);
		color: var(--text-dim);
		cursor: pointer;
		opacity: 0;
		transition:
			opacity 120ms ease,
			color 120ms ease;
	}

	.prose :global(.code-copy svg) {
		width: 0.9rem;
		height: 0.9rem;
	}

	.prose :global(.code-copy.copied) {
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
	}

	.prose :global(.code-frame-body:hover .code-copy),
	.prose :global(.code-copy:focus-visible) {
		opacity: 1;
	}

	@media (hover: hover) and (pointer: fine) {
		.prose :global(.code-copy:hover) {
			color: var(--accent-soft);
		}
	}

	@media (hover: none) {
		.prose :global(.code-copy) {
			opacity: 1;
		}
	}

	.prose :global(blockquote) {
		margin: 1rem 0;
		padding: 0.75rem 0.9rem;
		border-left: 3px solid var(--accent);
		border-radius: 0 0.45rem 0.45rem 0;
		background: color-mix(in srgb, var(--bg-soft) 86%, transparent);
		color: var(--text-soft);
	}

	/* ---- pager ---- */

	.pager {
		margin-top: 3.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--line);
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}

	.pager a {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		max-width: 48%;
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
		color: var(--text-soft);
		transition: color 120ms ease;
	}

	.pager a:hover {
		color: var(--accent-strong);
	}

	.pager .next {
		margin-left: auto;
		text-align: right;
	}

	.pager span[aria-hidden='true'] {
		color: var(--text-dim);
		transition: transform 140ms ease;
	}

	@media (hover: hover) and (pointer: fine) {
		.pager .next:hover span[aria-hidden='true'] {
			transform: translateX(3px);
		}

		.pager .prev:hover span[aria-hidden='true'] {
			transform: translateX(-3px);
		}
	}

	/* ---- toc rail ---- */

	.toc-rail {
		position: sticky;
		top: 3.6rem;
		height: calc(100vh - 3.6rem);
		overflow-y: auto;
		padding: 1.75rem 0 2.5rem 1.25rem;
		font-size: 0.8rem;
	}

	.toc-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0 0 0.9rem;
		font-weight: 700;
		color: var(--text);
	}

	.toc-title svg {
		width: 0.8rem;
		height: 0.8rem;
		color: var(--text-dim);
	}

	/* A vertical rail (::before) with an accent "read" overlay (::after)
	   that grows toward the active heading, plus a per-item dot — inspired
	   by scroll-spy TOC treatments, not a literal copy of any one of them. */
	.toc-rail ul {
		position: relative;
		list-style: none;
		margin: 0;
		padding: 0 0 0 1rem;
		display: grid;
		gap: 0.55rem;
	}

	.toc-rail ul::before,
	.toc-rail ul::after {
		content: '';
		position: absolute;
		left: 0.2rem;
		width: 1px;
	}

	.toc-rail ul::before {
		top: 0.55em;
		bottom: 0.55em;
		background: var(--line);
	}

	.toc-rail ul::after {
		top: 0.55em;
		height: var(--toc-progress, 0%);
		background: var(--accent);
		transition: height 220ms ease;
	}

	.toc-rail li {
		position: relative;
	}

	.toc-rail li::before {
		content: '';
		position: absolute;
		left: -0.8rem;
		top: 0.55em;
		width: 5px;
		height: 5px;
		border-radius: 999px;
		background: var(--line-strong);
		transform: translate(-50%, -50%);
		transition:
			background-color 200ms ease,
			box-shadow 200ms ease;
	}

	.toc-rail li.depth3 {
		padding-left: 0.85rem;
	}

	.toc-rail li.read::before {
		background: var(--accent);
	}

	.toc-rail li.active::before {
		background: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
	}

	.toc-rail a {
		display: block;
		text-decoration: none;
		color: var(--text-dim);
		line-height: 1.4;
		transition: color 120ms ease;
	}

	.toc-rail li.read a {
		color: var(--text-soft);
	}

	.toc-rail li.active a {
		color: var(--accent-strong);
		font-weight: 600;
	}

	.toc-rail a:hover {
		color: var(--text);
	}

	.toc-rail li.read a:hover,
	.toc-rail li.active a:hover {
		color: var(--accent-soft);
	}

	/* ---- responsive ---- */

	@media (max-width: 1100px) {
		.docs-layout {
			grid-template-columns: 16rem minmax(0, 1fr);
		}

		.docs-layout.nav-collapsed {
			grid-template-columns: 2.6rem minmax(0, 1fr);
		}

		.toc-rail {
			display: none;
		}
	}

	@media (max-width: 900px) {
		.docs-layout,
		.docs-layout.nav-collapsed {
			grid-template-columns: 1fr;
			padding-top: 0.85rem;
		}

		.mobile-toggle {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			justify-self: start;
			padding: 0.5rem 0.85rem;
			border: 1px solid var(--line);
			border-radius: 0.55rem;
			background: color-mix(in srgb, var(--bg-soft) 88%, transparent);
			color: var(--text);
			font-weight: 600;
		}

		aside {
			display: none;
			position: static;
			height: auto;
			border-right: none;
			border-bottom: 1px solid var(--line);
			overflow: visible;
		}

		aside.open {
			display: block;
		}

		aside nav,
		.nav-collapsed aside nav {
			display: block;
			padding: 0.85rem 0 1.25rem;
			overflow-y: visible;
		}

		.rail-toggle {
			display: none;
		}

		.doc-col {
			max-width: none;
			padding: 1.5rem 0 3rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.docs-layout,
		.rail-toggle svg {
			transition-duration: 0.01ms;
		}
	}
</style>
