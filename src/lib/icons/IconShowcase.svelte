<script lang="ts">
	import PageIcon from './PageIcon.svelte';
	import { ICONS } from './icon-set';

	const names = Object.keys(ICONS);
</script>

<div class="icon-showcase">
	{#each names as name (name)}
		<div class="icon-sample">
			<div class="icon-swatch">
				<PageIcon {name} class="icon-svg" />
			</div>
			<code>{name}</code>
		</div>
	{/each}
</div>

<style>
	.icon-showcase {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		margin: 1.25rem 0;
	}

	.icon-sample {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		width: 4.5rem;
	}

	.icon-swatch {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid var(--line);
		border-radius: 0.6rem;
		background: var(--bg-soft);
	}

	.icon-sample :global(.icon-svg) {
		width: 1.3rem;
		height: 1.3rem;
		color: var(--accent-strong);
	}

	.icon-sample code {
		font-size: 0.72rem;
		color: var(--text-dim);
	}
</style>
