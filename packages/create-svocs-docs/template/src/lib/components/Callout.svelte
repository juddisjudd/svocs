<script lang="ts">
	import type { Snippet } from 'svelte';

	type CalloutType = 'info' | 'note' | 'tip' | 'warning' | 'danger';

	let { type = 'info', children }: { type?: CalloutType; children: Snippet } = $props();

	const labels: Record<CalloutType, string> = {
		info: 'Info',
		note: 'Note',
		tip: 'Tip',
		warning: 'Warning',
		danger: 'Danger'
	};
</script>

<div class="callout {type}" role="note">
	<svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
		{#if type === 'warning' || type === 'danger'}
			<path
				d="M8 1.5 15 14H1L8 1.5Z"
				fill="none"
				stroke="currentColor"
				stroke-width="1.3"
				stroke-linejoin="round"
			/>
			<path d="M8 6.2v3.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
			<circle cx="8" cy="11.7" r="0.9" fill="currentColor" />
		{:else if type === 'tip'}
			<path
				d="M8 1.5a4.5 4.5 0 0 0-2.5 8.25c.35.25.5.6.5 1V12h4v-1.25c0-.4.15-.75.5-1A4.5 4.5 0 0 0 8 1.5Z"
				fill="none"
				stroke="currentColor"
				stroke-width="1.3"
				stroke-linejoin="round"
			/>
			<path d="M6.25 14.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
		{:else}
			<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3" />
			<path d="M8 7.2v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
			<circle cx="8" cy="4.9" r="0.9" fill="currentColor" />
		{/if}
	</svg>
	<div class="body">
		<p class="label">{labels[type]}</p>
		<div class="content">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.callout {
		--callout-color: var(--accent);
		display: flex;
		gap: 0.65rem;
		margin: 1.25rem 0;
		padding: 0.85rem 1rem;
		border-radius: 0.65rem;
		border: 1px solid color-mix(in srgb, var(--callout-color) 35%, var(--line));
		background: color-mix(in srgb, var(--callout-color) 8%, var(--bg-soft));
	}

	.callout.note {
		--callout-color: var(--text-dim);
	}

	.callout.tip {
		--callout-color: #3ecf8e;
	}

	.callout.warning {
		--callout-color: #e8b339;
	}

	.callout.danger {
		--callout-color: var(--danger);
	}

	.icon {
		flex-shrink: 0;
		width: 1.1rem;
		height: 1.1rem;
		margin-top: 0.15rem;
		color: var(--callout-color);
	}

	.body {
		min-width: 0;
	}

	.label {
		margin: 0 0 0.15rem;
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--callout-color);
	}

	.content {
		font-size: 0.92rem;
		line-height: 1.6;
		color: var(--text-soft);
	}

	.content :global(p:first-child) {
		margin-top: 0;
	}

	.content :global(p:last-child) {
		margin-bottom: 0;
	}
</style>
