<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="bleed">
	{@render children()}
</div>

<style>
	/* Breaks a wide table/image out of the prose column's side padding.
	   Matches .doc-col's own padding (see docs/+layout.svelte) so the bleed
	   reaches exactly to that column's edge, not the full viewport. */
	.bleed {
		margin-inline: -3rem;
	}

	@media (max-width: 900px) {
		.bleed {
			margin-inline: 0;
		}
	}
</style>
