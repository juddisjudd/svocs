<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { setContext } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getBreadcrumbsByPath, type PageMapNode } from '$lib/core/page-map';
	import { DOCS_PAGE_MAP_CONTEXT } from '$lib/core/page-map-context';
	import SidebarTree from '$lib/themes/docs/SidebarTree.svelte';
	import Toc from '$lib/themes/docs/Toc.svelte';
	import { enhanceCodeBlocks } from '$lib/themes/docs/code-blocks';
	import { renderMermaidBlocks } from '$lib/themes/docs/mermaid';
	import { observeHeadings } from '$lib/themes/docs/scroll-spy';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	let sidebarOpen = $state(false);
	let navCollapsed = $state(browser && localStorage.getItem('docs-nav') === 'collapsed');
	let proseEl: HTMLDivElement | undefined = $state();
	let activeHeadingId: string | undefined = $state();

	function closeSidebar() {
		sidebarOpen = false;
	}

	function toggleNav() {
		navCollapsed = !navCollapsed;
		try {
			localStorage.setItem('docs-nav', navCollapsed ? 'collapsed' : 'open');
		} catch {
			// storage unavailable — collapse still applies for this page view
		}
	}

	// A getter, not the array itself: reading `data.pageMap` here (component
	// init, outside any reactive context) would only capture its initial
	// value. Consumers call this inside their own `$derived` instead.
	setContext(DOCS_PAGE_MAP_CONTEXT, () => data.pageMap);

	const currentPath = $derived(page.url.pathname.replace(/\/$/, '') || '/docs');
	const breadcrumbs = $derived(getBreadcrumbsByPath(currentPath, data.pageMap));

	type TocItem = { id: string; text: string; depth: number };
	const toc = $derived((page.data.toc ?? []) as TocItem[]);

	// Re-scan for un-enhanced code blocks and re-attach the TOC scroll-spy
	// whenever navigation swaps in a new doc page's static markup.
	$effect(() => {
		void currentPath;
		enhanceCodeBlocks(proseEl ?? null);
		renderMermaidBlocks(proseEl ?? null);
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
	// /docs renders the introduction document, so page through as that entry
	const pagerPath = $derived(currentPath === '/docs' ? '/docs/introduction' : currentPath);
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
			<svg viewBox="0 0 16 16" aria-hidden="true" class:flipped={navCollapsed}>
				<path
					d="m9 4-4 4 4 4"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d="m13 4-4 4 4 4"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
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
			<Toc items={toc} activeId={activeHeadingId} />
		{/if}
	</nav>
</div>

<style>
	.docs-layout {
		display: grid;
		grid-template-columns: 17.5rem minmax(0, 1fr) 15.5rem;
		padding: 0 1rem;
		transition: grid-template-columns 220ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.docs-layout.nav-collapsed {
		grid-template-columns: 2.6rem minmax(0, 1fr) 15.5rem;
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
		overflow-x: hidden;
		/* wheel/trackpad momentum at the nav's edge stays in the nav instead
		   of spilling into the page scroll */
		overscroll-behavior: contain;
		padding: 1.5rem 0.75rem 1rem 0;
	}

	/* Minimal auto-hiding scrollbars for the two rails: invisible until the
	   pointer is over (or focus is inside) the rail. */
	aside nav,
	.toc-rail {
		scrollbar-width: thin;
		scrollbar-color: transparent transparent;
	}

	aside nav:hover,
	aside nav:focus-within,
	.toc-rail:hover,
	.toc-rail:focus-within {
		scrollbar-color: color-mix(in srgb, var(--line-strong) 85%, transparent) transparent;
	}

	/* Safari has no scrollbar-width/color; browsers that support them ignore
	   these ::-webkit-scrollbar rules. */
	aside nav::-webkit-scrollbar,
	.toc-rail::-webkit-scrollbar {
		width: 6px;
	}

	aside nav::-webkit-scrollbar-thumb,
	.toc-rail::-webkit-scrollbar-thumb {
		background: transparent;
		border-radius: 3px;
	}

	aside nav:hover::-webkit-scrollbar-thumb,
	.toc-rail:hover::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, var(--line-strong) 85%, transparent);
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
		width: 0.95rem;
		height: 0.95rem;
		transition: transform 200ms ease;
	}

	.rail-toggle svg.flipped {
		transform: rotate(180deg);
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

	/* code-frame markup comes from the build-time highlighter, code-copy
	   from enhanceCodeBlocks() — not this component, hence :global. */
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
		color: var(--text-soft);
	}

	/* Prism token colors — mdsvex tokenizes fences at build time but ships no
	   theme, so without these rules code renders monochrome. Palette lives in
	   the --code-* vars beside the rest of the theme (src/routes/+layout.svelte). */
	.prose :global(.token.comment),
	.prose :global(.token.prolog),
	.prose :global(.token.doctype),
	.prose :global(.token.cdata) {
		color: var(--code-comment);
		font-style: italic;
	}

	.prose :global(.token.punctuation) {
		color: var(--code-punctuation);
	}

	.prose :global(.token.keyword),
	.prose :global(.token.tag),
	.prose :global(.token.selector),
	.prose :global(.token.important),
	.prose :global(.token.atrule) {
		color: var(--code-keyword);
	}

	.prose :global(.token.string),
	.prose :global(.token.char),
	.prose :global(.token.attr-value),
	.prose :global(.token.regex),
	.prose :global(.token.inserted) {
		color: var(--code-string);
	}

	.prose :global(.token.function),
	.prose :global(.token.class-name) {
		color: var(--code-function);
	}

	.prose :global(.token.number),
	.prose :global(.token.boolean),
	.prose :global(.token.constant),
	.prose :global(.token.symbol),
	.prose :global(.token.deleted) {
		color: var(--code-number);
	}

	.prose :global(.token.property),
	.prose :global(.token.attr-name),
	.prose :global(.token.builtin),
	.prose :global(.token.variable),
	.prose :global(.token.entity) {
		color: var(--code-property);
	}

	.prose :global(.token.operator),
	.prose :global(.token.url) {
		color: var(--code-operator);
	}

	.prose :global(.token.bold) {
		font-weight: 600;
	}

	.prose :global(.token.italic) {
		font-style: italic;
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

	.prose :global(img) {
		max-width: 100%;
		border: 1px solid var(--line);
		border-radius: 0.65rem;
	}

	/* Mermaid source shows briefly before the lazy client renderer swaps in
	   the SVG; style it small and dim until then. */
	.prose :global(pre.mermaid) {
		display: flex;
		justify-content: center;
		margin: 1rem 0;
		padding: 0.5rem 0;
		border: none;
		background: transparent;
		overflow-x: auto;
		font-size: 0.8rem;
		color: var(--text-dim);
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
		/* long TOC titles wrap (see Toc.svelte); never a horizontal bar */
		overflow-x: hidden;
		overscroll-behavior: contain;
		padding: 1.75rem 0 2.5rem 1.25rem;
		font-size: 0.8rem;
	}

	/* ---- responsive ---- */

	@media (max-width: 1100px) {
		.docs-layout {
			grid-template-columns: 17.5rem minmax(0, 1fr);
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
