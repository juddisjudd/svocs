<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageMapNode } from '$lib/core/page-map';
	import SidebarTree from './SidebarTree.svelte';

	let {
		node,
		currentPath,
		onNavigate,
		depth = 0
	}: {
		node: PageMapNode;
		currentPath: string;
		onNavigate: () => void;
		depth?: number;
	} = $props();

	const hasChildren = $derived(node.kind === 'page' && node.children.length > 0);
	const isActive = $derived(node.kind === 'page' && currentPath === node.path);
	const onActivePath = $derived(
		node.kind === 'page' && (currentPath === node.path || currentPath.startsWith(`${node.path}/`))
	);

	// Writable derived: sections re-open automatically when navigating into
	// them, while manual toggles still win until the path changes again.
	let expanded = $derived(depth === 0 || onActivePath);
</script>

{#if node.kind === 'separator'}
	<li class="separator">{node.title}</li>
{:else if node.kind === 'page'}
	<li>
		<div class="row">
			{#if node.isDocument}
				<a
					href={node.slug ? resolve('/docs/[...slug]', { slug: node.slug }) : resolve('/docs')}
					onclick={onNavigate}
					aria-current={isActive ? 'page' : undefined}
				>
					{node.title}
				</a>
			{:else}
				<button
					type="button"
					class="group"
					aria-expanded={expanded}
					onclick={() => (expanded = !expanded)}
				>
					{node.title}
				</button>
			{/if}

			{#if hasChildren}
				<button
					type="button"
					class="chev"
					class:open={expanded}
					aria-expanded={expanded}
					aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.title}`}
					onclick={() => (expanded = !expanded)}
				>
					<svg viewBox="0 0 16 16" aria-hidden="true">
						<path
							d="m6 4 4 4-4 4"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			{/if}
		</div>

		{#if hasChildren && expanded}
			<SidebarTree nodes={node.children} {currentPath} {onNavigate} depth={depth + 1} />
		{/if}
	</li>
{/if}

<style>
	li {
		display: grid;
		gap: 0.15rem;
	}

	.separator {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin: 1.35rem 0 0.3rem;
		padding: 0 0.6rem;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-dim);
	}

	/* Trailing hairline marks these as group dividers, not dimmer nav links. */
	.separator::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--line);
	}

	li.separator:first-child {
		margin-top: 0;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.15rem;
	}

	a,
	.group {
		flex: 1;
		min-width: 0;
		display: block;
		text-align: left;
		text-decoration: none;
		padding: 0.34rem 0.6rem;
		border-radius: 0.4rem;
		border: none;
		background: transparent;
		font: inherit;
		font-size: 0.9rem;
		color: var(--text-soft);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	a:hover,
	.group:hover {
		background: color-mix(in srgb, var(--bg-soft) 84%, transparent);
		color: var(--text);
	}

	a[aria-current='page'] {
		background: color-mix(in srgb, var(--accent) 11%, transparent);
		color: var(--accent-strong);
		font-weight: 600;
	}

	.chev {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: none;
		border-radius: 0.35rem;
		background: transparent;
		color: var(--text-dim);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.chev:hover {
		background: color-mix(in srgb, var(--bg-soft) 84%, transparent);
		color: var(--text);
	}

	.chev svg {
		width: 0.8rem;
		height: 0.8rem;
		transition: transform 160ms ease;
	}

	.chev.open svg {
		transform: rotate(90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.chev svg {
			transition-duration: 0.01ms;
		}
	}
</style>
