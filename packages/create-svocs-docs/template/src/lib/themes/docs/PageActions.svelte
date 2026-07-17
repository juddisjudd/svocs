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
	<button type="button" onclick={copyMarkdown} class:copied>
		{#if copied}
			<svg viewBox="0 0 16 16" aria-hidden="true">
				<path
					d="m3.5 8.5 3 3 6-6.5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		{:else}
			<svg viewBox="0 0 16 16" aria-hidden="true">
				<rect
					x="5.25"
					y="5.25"
					width="8"
					height="8.5"
					rx="1.1"
					fill="none"
					stroke="currentColor"
					stroke-width="1.3"
				/>
				<path
					d="M3.75 10.25v-6.5a1.5 1.5 0 0 1 1.5-1.5h5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.3"
					stroke-linecap="round"
				/>
			</svg>
		{/if}
		{copied ? 'Copied' : 'Copy Markdown'}
	</button>
	<a href={markdownHref} target="_blank" rel="noreferrer">
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<path
				d="M1 8s2.3-4.5 7-4.5S15 8 15 8s-2.3 4.5-7 4.5S1 8 1 8Z"
				fill="none"
				stroke="currentColor"
				stroke-width="1.3"
				stroke-linejoin="round"
			/>
			<circle cx="8" cy="8" r="1.9" fill="none" stroke="currentColor" stroke-width="1.3" />
		</svg>
		View as Markdown
	</a>
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
		gap: 0.4rem;
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

	button svg,
	a svg {
		flex-shrink: 0;
		width: 0.85rem;
		height: 0.85rem;
	}

	button:hover,
	a:hover {
		color: var(--accent-soft);
	}

	button.copied {
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
	}
</style>
