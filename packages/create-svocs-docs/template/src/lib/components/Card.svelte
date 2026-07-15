<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		href,
		external = false,
		children
	}: { title: string; href?: string; external?: boolean; children?: Snippet } = $props();
</script>

{#snippet body()}
	<strong>{title}</strong>
	{#if children}
		<span>{@render children()}</span>
	{/if}
	{#if href}
		<em aria-hidden="true">{external ? '↗' : '→'}</em>
	{/if}
{/snippet}

{#if href}
	<!-- Card is a generic pass-through: callers resolve() internal routes
	     themselves before passing href, since this component also accepts
	     plain external URLs. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		class="card"
		{href}
		target={external ? '_blank' : undefined}
		rel={external ? 'noreferrer' : undefined}
	>
		{@render body()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<div class="card">
		{@render body()}
	</div>
{/if}

<style>
	.card {
		position: relative;
		display: grid;
		gap: 0.3rem;
		padding: 1rem 2.4rem 1rem 1.1rem;
		border-radius: 0.75rem;
		border: 1px solid var(--line);
		background: var(--bg-elev);
		text-decoration: none;
		color: inherit;
		transition: transform 150ms ease;
	}

	a.card {
		cursor: pointer;
	}

	.card strong {
		color: var(--text);
		font-size: 0.95rem;
		transition: color 150ms ease;
	}

	.card span {
		font-size: 0.85rem;
		line-height: 1.55;
		color: var(--text-dim);
	}

	.card em {
		position: absolute;
		top: 1rem;
		right: 1rem;
		font-style: normal;
		color: var(--text-dim);
		transition:
			color 150ms ease,
			transform 150ms ease;
	}

	@media (hover: hover) and (pointer: fine) {
		a.card:hover {
			transform: translateY(-2px);
		}

		a.card:hover strong {
			color: var(--accent-strong);
		}

		a.card:hover em {
			color: var(--accent-soft);
			transform: translateX(2px);
		}
	}
</style>
