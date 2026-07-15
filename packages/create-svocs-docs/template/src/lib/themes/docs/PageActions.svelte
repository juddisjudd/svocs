<script lang="ts">
	import { resolve } from '$app/paths';

	let { slug }: { slug: string } = $props();

	const markdownHref = $derived(resolve('/docs/[...slug].md', { slug }));

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyMarkdown() {
		try {
			const res = await fetch(markdownHref);
			const raw = await res.text();
			await navigator.clipboard.writeText(raw);
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 1600);
		} catch {
			// fetch/clipboard unavailable — "View as Markdown" still works
		}
	}
</script>

<div class="page-actions">
	<button type="button" onclick={copyMarkdown}>
		{copied ? 'Copied' : 'Copy Markdown'}
	</button>
	<a href={markdownHref} target="_blank" rel="noreferrer">View as Markdown</a>
</div>

<style>
	.page-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	button,
	a {
		display: inline-flex;
		align-items: center;
		font-size: 0.78rem;
		font-weight: 550;
		padding: 0.3rem 0.6rem;
		border-radius: 0.4rem;
		border: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg-soft) 88%, transparent);
		color: var(--text-dim);
		text-decoration: none;
		cursor: pointer;
		transition: color 120ms ease;
	}

	button:hover,
	a:hover {
		color: var(--accent-soft);
	}
</style>
