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
	<div class="header">
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
		<span class="label">{labels[type]}</span>
	</div>
	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	/*
	 * The header color is fixed rather than theme-adaptive (a solid brand
	 * color reads as the same "flag" in light or dark mode), but each shade
	 * is chosen to hold white text at WCAG AA contrast (4.5:1) on its own —
	 * the brand accent and the original warning gold both fell short of that
	 * (3.6:1 and 2.8:1) once used as a full-bleed fill instead of just text,
	 * hence the darker info/warning values below. The body uses the page's
	 * own surface/text tokens so it sits naturally in both themes instead of
	 * a fixed dark box fighting a light page.
	 */
	.callout {
		--callout-color: #cc3000;
		margin: 1.25rem 0;
		border-radius: 0.5rem;
		border: 1px solid var(--line);
		overflow: hidden;
	}

	.callout.note {
		--callout-color: #5b5551;
	}

	.callout.tip {
		--callout-color: #1f7a45;
	}

	.callout.warning {
		--callout-color: #8a6c1f;
	}

	.callout.danger {
		--callout-color: #8a2a2a;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 1rem;
		background: var(--callout-color);
		color: #fff;
	}

	.icon {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
	}

	.label {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.content {
		padding: 0.85rem 1rem;
		background: var(--bg-soft);
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
