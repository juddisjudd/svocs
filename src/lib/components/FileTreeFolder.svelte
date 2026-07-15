<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		name,
		open = false,
		children
	}: { name: string; open?: boolean; children: Snippet } = $props();
</script>

<li>
	<details {open}>
		<summary>
			<svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
				<path
					d="M1.5 4a1 1 0 0 1 1-1h3.4l1.2 1.4h6.4a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4Z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.2"
					stroke-linejoin="round"
				/>
			</svg>
			{name}
		</summary>
		<ul>
			{@render children()}
		</ul>
	</details>
</li>

<style>
	details {
		width: 100%;
	}

	summary {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		list-style: none;
		color: var(--text);
		font-weight: 600;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.icon {
		width: 0.95rem;
		height: 0.95rem;
		flex-shrink: 0;
		color: var(--accent-soft);
	}

	ul {
		list-style: none;
		margin: 0.25rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.2rem;
	}
</style>
