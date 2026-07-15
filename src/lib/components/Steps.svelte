<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="steps">
	{@render children()}
</div>

<style>
	/* Authors write a plain sequence of `### heading` + prose per step; this
	   restyles h3 into numbered, connected markers via CSS counters so the
	   markdown itself stays plain and portable. */
	.steps {
		counter-reset: step;
		margin: 1.25rem 0;
		padding-left: 2.25rem;
		border-left: 1px solid var(--line);
	}

	.steps :global(h3) {
		position: relative;
		margin: 1.75rem 0 0.5rem;
		font-size: 1.05rem;
	}

	.steps :global(h3:first-child) {
		margin-top: 0;
	}

	.steps :global(h3)::before {
		counter-increment: step;
		content: counter(step);
		position: absolute;
		left: -2.9rem;
		top: -0.05rem;
		display: grid;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 999px;
		border: 1px solid var(--line-strong);
		background: var(--bg-soft);
		color: var(--text);
		font-size: 0.85rem;
		font-weight: 700;
	}

	.steps :global(p),
	.steps :global(ul),
	.steps :global(ol),
	.steps :global(pre) {
		margin-top: 0.5rem;
	}
</style>
