<script lang="ts">
	import type { Attachment } from 'svelte/attachments';

	type TocItem = { id: string; text: string; depth: number };

	let { items, activeId }: { items: TocItem[]; activeId?: string } = $props();

	// One continuous SVG path through every item, with the active span lit
	// via stroke-dasharray so the highlight glides instead of jumping.
	let pathD = $state('');
	let totalLength = $state(0);
	let segments = $state.raw<{ start: number; length: number }[]>([]);

	const activeIndex = $derived(items.findIndex((item) => item.id === activeId));
	const activeSegment = $derived(activeIndex >= 0 ? segments[activeIndex] : undefined);

	function railX(depth: number): number {
		return depth >= 3 ? 16 : 3;
	}

	function measure(el: HTMLElement) {
		const rows = el.querySelectorAll('li');
		if (rows.length === 0) {
			pathD = '';
			segments = [];
			return;
		}

		let d = '';
		let dist = 0;
		const segs: { start: number; length: number }[] = [];
		let prev: { x: number; y: number } | undefined;

		rows.forEach((row, i) => {
			const x = railX(items[i]?.depth ?? 2);
			const top = row.offsetTop + 3;
			const bottom = row.offsetTop + row.offsetHeight - 3;
			if (prev) {
				dist += Math.hypot(x - prev.x, top - prev.y);
				d += ` L${x} ${top}`;
			} else {
				d = `M${x} ${top}`;
			}
			segs.push({ start: dist, length: bottom - top });
			dist += bottom - top;
			d += ` L${x} ${bottom}`;
			prev = { x, y: bottom };
		});

		pathD = d;
		totalLength = dist;
		segments = segs;
	}

	// The synchronous measure() reads `items`, re-running the attachment on
	// TOC changes; the ResizeObserver covers wraps and font swaps between.
	const measureRail: Attachment<HTMLDivElement> = (el) => {
		measure(el);
		const observer = new ResizeObserver(() => measure(el));
		observer.observe(el);
		return () => observer.disconnect();
	};
</script>

<p class="toc-title">
	<svg viewBox="0 0 16 16" aria-hidden="true">
		<path
			d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7"
			fill="none"
			stroke="currentColor"
			stroke-width="1.4"
			stroke-linecap="round"
		/>
	</svg>
	On this page
</p>

<div class="toc-body" {@attach measureRail}>
	<svg class="rail-svg" aria-hidden="true">
		{#if pathD}
			<path class="rail" d={pathD} />
			{#if activeSegment}
				<path
					class="thumb"
					d={pathD}
					stroke-dasharray="{activeSegment.length} {totalLength}"
					stroke-dashoffset={-activeSegment.start}
				/>
			{/if}
		{/if}
	</svg>
	<ul>
		{#each items as item, i (item.id)}
			<li class:depth3={item.depth >= 3} class:active={i === activeIndex}>
				<a href={`#${item.id}`} aria-current={i === activeIndex ? 'true' : undefined}>
					{item.text}
				</a>
			</li>
		{/each}
	</ul>
</div>

<style>
	.toc-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0 0 0.9rem;
		font-weight: 700;
		color: var(--text);
	}

	.toc-title svg {
		width: 0.8rem;
		height: 0.8rem;
		color: var(--text-dim);
	}

	.toc-body {
		position: relative;
	}

	.rail-svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}

	.rail {
		fill: none;
		stroke: var(--line);
		stroke-width: 1;
	}

	.thumb {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
		stroke-linecap: round;
		transition:
			stroke-dasharray 300ms cubic-bezier(0.23, 1, 0.32, 1),
			stroke-dashoffset 300ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0 0 0 1.1rem;
		display: grid;
		gap: 0.55rem;
	}

	li.depth3 {
		padding-left: 0.85rem;
	}

	a {
		display: block;
		text-decoration: none;
		color: var(--text-dim);
		line-height: 1.4;
		/* long or unbroken heading text wraps instead of widening the rail */
		overflow-wrap: anywhere;
		transition: color 120ms ease;
	}

	a:hover {
		color: var(--text);
	}

	li.active a {
		color: var(--accent-strong);
		font-weight: 600;
	}

	li.active a:hover {
		color: var(--accent-soft);
	}

	@media (prefers-reduced-motion: reduce) {
		.thumb {
			transition: none;
		}
	}
</style>
