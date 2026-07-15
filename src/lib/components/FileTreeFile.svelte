<script lang="ts">
	let { name }: { name: string } = $props();
</script>

<li class="file">
	<svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
		<path
			d="M4 1.5h5.5L12.5 4.5V14.5h-8.5V1.5Z"
			fill="none"
			stroke="currentColor"
			stroke-width="1.2"
			stroke-linejoin="round"
		/>
		<path d="M9.5 1.5V4.5h3" fill="none" stroke="currentColor" stroke-width="1.2" />
	</svg>
	{name}
</li>

<style>
	.file {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--text-soft);
	}

	.icon {
		width: 0.95rem;
		height: 0.95rem;
		flex-shrink: 0;
		color: var(--text-dim);
	}
</style>
