<script lang="ts">
	import { ICONS } from './icon-set';

	let { name, class: className = '' }: { name?: string; class?: string } = $props();

	const shapes = $derived(name ? ICONS[name] : undefined);
</script>

{#if shapes}
	<svg viewBox="0 0 16 16" aria-hidden="true" class={className}>
		{#each shapes as shape, i (i)}
			{#if shape.type === 'path'}
				<path
					d={shape.d}
					fill={shape.fill ?? 'none'}
					stroke={shape.stroke ?? 'currentColor'}
					stroke-width="1.3"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{:else if shape.type === 'circle'}
				<circle
					cx={shape.cx}
					cy={shape.cy}
					r={shape.r}
					fill={shape.fill ?? 'none'}
					stroke={shape.fill === 'currentColor' ? 'none' : 'currentColor'}
					stroke-width="1.3"
				/>
			{:else if shape.type === 'rect'}
				<rect
					x={shape.x}
					y={shape.y}
					width={shape.width}
					height={shape.height}
					rx={shape.rx ?? 0}
					fill="none"
					stroke="currentColor"
					stroke-width="1.3"
				/>
			{/if}
		{/each}
	</svg>
{/if}
