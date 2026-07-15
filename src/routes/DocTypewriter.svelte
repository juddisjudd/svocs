<script lang="ts">
	import { browser } from '$app/environment';

	type Token = { text: string; cls?: string };
	type Phase = 'typing' | 'hold-code' | 'revealing' | 'hold-docs' | 'hiding';

	const LINES: Token[][] = [
		[{ text: '# ', cls: 'k' }, { text: 'Quick Start' }],
		[],
		[{ text: 'Scaffold a project and ship' }],
		[{ text: 'a static site with ' }, { text: 'Svelte 5', cls: 'f' }, { text: '.' }],
		[],
		[{ text: '## ', cls: 'k' }, { text: 'Add a page' }],
		[],
		[{ text: '- ', cls: 'p' }, { text: 'Drop a file in ' }, { text: 'content/', cls: 'v' }],
		[{ text: '- ', cls: 'p' }, { text: 'Preview at ' }, { text: 'bun run dev', cls: 'v' }]
	];

	// The "rendered" side after the wipe is hand-authored to match LINES
	// above exactly, so the reveal reads as "this markdown becomes this
	// page" rather than an unrelated skeleton. The nav mirrors this site's
	// own content/_meta.json category structure — non-clickable headings
	// grouping real pages, the actual feature this card is selling.
	type NavRow = { kind: 'heading' | 'item'; label: string; current?: boolean };
	const NAV_ROWS: NavRow[] = [
		{ kind: 'heading', label: 'Getting Started' },
		{ kind: 'item', label: 'Introduction' },
		{ kind: 'item', label: 'Quick Start', current: true },
		{ kind: 'heading', label: 'Guides' },
		{ kind: 'item', label: 'Writing Content' },
		{ kind: 'item', label: 'Components' }
	];

	const reducedMotion = browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let phase = $state<Phase>(reducedMotion ? 'hold-docs' : 'typing');
	let lineIndex = $state(0);
	let charIndex = $state(0);

	function lineText(line: Token[]): string {
		return line.map((t) => t.text).join('');
	}

	function sliceLine(line: Token[], count: number): Token[] {
		const out: Token[] = [];
		let remaining = count;
		for (const token of line) {
			if (remaining <= 0) break;
			if (token.text.length <= remaining) {
				out.push(token);
				remaining -= token.text.length;
			} else {
				out.push({ text: token.text.slice(0, remaining), cls: token.cls });
				remaining = 0;
			}
		}
		return out;
	}

	function tokensForLine(line: Token[], i: number): Token[] {
		if (phase !== 'typing' || i < lineIndex) return line;
		if (i === lineIndex) return sliceLine(line, charIndex);
		return [];
	}

	$effect(() => {
		if (reducedMotion) return;

		let cancelled = false;
		let handle: ReturnType<typeof setTimeout>;
		const schedule = (fn: () => void, delay: number) => {
			handle = setTimeout(() => {
				if (!cancelled) fn();
			}, delay);
		};

		if (phase === 'typing') {
			const text = lineText(LINES[lineIndex]);
			if (charIndex < text.length) {
				schedule(() => (charIndex += 1), 16 + Math.random() * 22);
			} else if (lineIndex < LINES.length - 1) {
				schedule(
					() => {
						lineIndex += 1;
						charIndex = 0;
					},
					text.length === 0 ? 70 : 110
				);
			} else {
				schedule(() => (phase = 'hold-code'), 60);
			}
		} else if (phase === 'hold-code') {
			schedule(() => (phase = 'revealing'), 850);
		} else if (phase === 'revealing') {
			schedule(() => (phase = 'hold-docs'), 900);
		} else if (phase === 'hold-docs') {
			schedule(() => (phase = 'hiding'), 3200);
		} else if (phase === 'hiding') {
			schedule(() => {
				lineIndex = 0;
				charIndex = 0;
				phase = 'typing';
			}, 650);
		}

		return () => {
			cancelled = true;
			clearTimeout(handle);
		};
	});
</script>

<div class="morph" aria-hidden="true" data-phase={phase}>
	<div class="morph-bar">
		<i></i><i></i><i></i>
		<span class="morph-url">svocs.dev/docs</span>
	</div>
	<div class="morph-stage">
		<pre class="morph-source">{#each LINES as line, i (i)}<span class="morph-line"
					>{#each tokensForLine(line, i) as token, j (j)}<i class={token.cls}>{token.text}</i
						>{/each}{#if phase === 'typing' && i === lineIndex}<i class="morph-caret"
						></i>{/if}</span
				>{/each}</pre>

		<div class="morph-rendered">
			<div class="doc-nav">
				{#each NAV_ROWS as row, i (i)}
					{#if row.kind === 'heading'}
						<span class="nav-heading">{row.label}</span>
					{:else}
						<span class="nav-item" class:current={row.current}>{row.label}</span>
					{/if}
				{/each}
			</div>
			<div class="doc-article">
				<h1>Quick Start</h1>
				<p>Scaffold a project and ship a static site with <b>Svelte 5</b>.</p>
				<h2>Add a page</h2>
				<ul>
					<li>Drop a file in <code>content/</code></li>
					<li>Preview at <code>bun run dev</code></li>
				</ul>
			</div>
			<div class="doc-toc">
				<span class="toc-label">On this page</span>
				<span class="toc-item">Add a page</span>
			</div>
		</div>

		{#if phase === 'revealing'}
			<div class="morph-sweep"></div>
		{/if}
	</div>
</div>

<style>
	.morph {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 15rem;
		border-radius: var(--radius-inner);
		border: 1px solid var(--panel-line);
		background: var(--panel);
		overflow: hidden;
	}

	.morph-bar {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.55rem 0.75rem;
		border-bottom: 1px solid var(--panel-line);
	}

	.morph-bar i {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		background: var(--panel-line-strong);
	}

	.morph-bar i:first-child {
		background: color-mix(in srgb, var(--accent) 65%, var(--panel-line-strong));
		transition: background-color 400ms ease;
	}

	.morph[data-phase='revealing'] .morph-bar i:first-child,
	.morph[data-phase='hold-docs'] .morph-bar i:first-child {
		background: #6fd88a;
	}

	.morph-url {
		margin-left: 0.5rem;
		font-family: 'Cascadia Code', Consolas, monospace;
		font-size: 0.68rem;
		color: var(--panel-dim);
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		background: var(--panel-soft);
	}

	.morph-stage {
		position: relative;
		flex: 1;
		min-height: 0;
	}

	.morph-source,
	.morph-rendered {
		position: absolute;
		inset: 0;
		padding: 1rem;
	}

	.morph-source {
		margin: 0;
		font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--panel-text);
		white-space: pre-wrap;
		overflow: hidden;
		opacity: 1;
		transform: scale(1);
		filter: blur(0);
		transition:
			opacity 550ms ease,
			transform 550ms cubic-bezier(0.23, 1, 0.32, 1),
			filter 550ms ease;
	}

	.morph-line {
		display: block;
		min-height: 1.2em;
	}

	.morph-source i {
		font-style: normal;
	}

	.morph-source i.k {
		color: var(--panel-accent-soft);
	}
	.morph-source i.f {
		color: var(--panel-accent);
	}
	.morph-source i.p {
		color: var(--panel-dim);
	}
	.morph-source i.a {
		color: var(--panel-syntax-attr);
	}
	.morph-source i.v {
		color: var(--panel-syntax-value);
	}

	.morph-caret {
		display: inline-block;
		width: 0.5em;
		height: 1em;
		margin-left: 1px;
		vertical-align: text-bottom;
		background: var(--panel-accent-soft);
		animation: caret-blink 0.9s steps(2) infinite;
	}

	@keyframes caret-blink {
		50% {
			opacity: 0;
		}
	}

	.morph-rendered {
		display: grid;
		grid-template-columns: 1fr 2.4fr 0.9fr;
		gap: 1.25rem;
		font-family: 'Satoshi', 'Aptos', 'Segoe UI Variable Text', 'Segoe UI', sans-serif;
		clip-path: inset(0 100% 0 0);
		opacity: 0;
		transition:
			clip-path 750ms cubic-bezier(0.23, 1, 0.32, 1),
			opacity 500ms ease;
	}

	.morph[data-phase='revealing'] .morph-source,
	.morph[data-phase='hold-docs'] .morph-source {
		opacity: 0;
		transform: scale(0.98);
		filter: blur(3px);
	}

	.morph[data-phase='revealing'] .morph-rendered,
	.morph[data-phase='hold-docs'] .morph-rendered {
		clip-path: inset(0 0 0 0);
		opacity: 1;
	}

	.doc-nav {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}

	.nav-item {
		padding: 0.25rem 0.5rem;
		border-radius: 0.35rem;
		font-size: 0.68rem;
		font-weight: 550;
		color: var(--panel-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nav-item.current {
		color: var(--panel-accent);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 18%, transparent);
	}

	.nav-heading {
		margin-top: 0.3rem;
		padding: 0 0.5rem;
		font-size: 0.58rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--panel-dim);
	}

	.nav-heading:first-child {
		margin-top: 0;
	}

	.doc-article {
		min-width: 0;
	}

	.doc-article h1 {
		margin: 0 0 0.55rem;
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: -0.01em;
		color: var(--panel-text-hi);
	}

	.doc-article p {
		margin: 0 0 0.7rem;
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--panel-text);
	}

	.doc-article p b {
		color: var(--panel-accent);
		font-weight: 700;
	}

	.doc-article h2 {
		margin: 0.5rem 0 0.4rem;
		font-size: 0.82rem;
		font-weight: 750;
		color: var(--panel-text-hi);
	}

	.doc-article ul {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.25rem;
	}

	.doc-article li {
		font-size: 0.7rem;
		line-height: 1.45;
		color: var(--panel-text);
	}

	.doc-article code {
		font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
		font-size: 0.66rem;
		padding: 0.06em 0.35em;
		border-radius: 0.3em;
		background: var(--panel-soft);
		border: 1px solid var(--panel-line);
		color: var(--panel-accent);
	}

	.doc-toc {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.toc-label {
		font-size: 0.66rem;
		font-weight: 700;
		color: var(--panel-text-hi);
	}

	.toc-item {
		font-size: 0.68rem;
		color: var(--panel-accent-soft);
	}

	.morph-sweep {
		position: absolute;
		inset: 0 auto 0 -18%;
		width: 26%;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--accent) 65%, transparent),
			transparent
		);
		/* screen blend reads as a bright glint on the default dark panel;
		   on the light panel (white-ish bg) screen washes out to nearly
		   invisible, so it flips to multiply there instead. */
		mix-blend-mode: screen;
		pointer-events: none;
		animation: sweep 800ms cubic-bezier(0.23, 1, 0.32, 1) both;
	}

	:global([data-theme='light']) .morph-sweep {
		mix-blend-mode: multiply;
	}

	@keyframes sweep {
		from {
			left: -18%;
			opacity: 0;
		}
		15% {
			opacity: 1;
		}
		80% {
			opacity: 1;
		}
		to {
			left: 112%;
			opacity: 0;
		}
	}

	@media (max-width: 640px) {
		.morph {
			/* rendered content (nav + article) runs taller than the base
			   15rem once the toc column drops out and text reflows */
			min-height: 17.5rem;
		}

		.morph-rendered {
			grid-template-columns: 1fr 2.4fr;
		}

		.doc-toc {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.morph-caret,
		.morph-sweep {
			animation: none;
		}

		.morph-source,
		.morph-rendered {
			transition-duration: 0.01ms;
		}
	}
</style>
