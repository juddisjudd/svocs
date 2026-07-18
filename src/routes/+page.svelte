<script lang="ts">
	import { resolve, asset } from '$app/paths';
	import type { PageData } from './$types';
	import DocTypewriter from './DocTypewriter.svelte';
	import VelvetBackground from './VelvetBackground.svelte';
	import { SITE_URL } from '$lib/site';
	import pmBun from '$lib/assets/pm-bun.svg';
	import pmPnpm from '$lib/assets/pm-pnpm.svg';
	import pmDeno from '$lib/assets/pm-deno.svg';
	import pmNub from '$lib/assets/pm-nub.svg';
	// Build-time import from the monorepo's own CLI package — the rendered
	// version is whatever this site build shipped with, no runtime fetch.
	import cliPkg from '../../packages/create-svocs-docs/package.json';

	let { data }: { data: PageData } = $props();

	// Colored "default" icon variants from thesvg.org, rendered via <img>
	// with no styling applied so each brand mark keeps its own colors.
	const PACKAGE_MANAGERS = [
		{ id: 'bun', label: 'Bun', command: 'bunx create-svocs-docs@latest', icon: pmBun },
		{ id: 'pnpm', label: 'pnpm', command: 'pnpm create svocs-docs', icon: pmPnpm },
		{ id: 'deno', label: 'Deno', command: 'deno run -A npm:create-svocs-docs', icon: pmDeno },
		{ id: 'nub', label: 'Nub', command: 'nubx create-svocs-docs@latest', icon: pmNub }
	];

	let pm = $state(PACKAGE_MANAGERS[0]);
	let pickerOpen = $state(false);
	let pmWrapEl: HTMLSpanElement | undefined = $state();
	const installCommand = $derived(pm.command);
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	function onWindowClick(event: MouseEvent) {
		if (pickerOpen && pmWrapEl && !pmWrapEl.contains(event.target as Node)) {
			pickerOpen = false;
		}
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			pickerOpen = false;
		}
	}

	async function copyInstall() {
		try {
			await navigator.clipboard.writeText(installCommand);
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 1600);
		} catch {
			// clipboard unavailable — leave the command selectable
		}
	}

	const pageTitle = 'SVOCS - Beautiful docs with Svelte & Markdown';
	const pageDescription =
		'SVOCS is a docs generator built on SvelteKit. Write Markdown, add Svelte components where you need them, and ship a static site with search built in.';

	const extras = [
		'Table of contents',
		'Breadcrumbs',
		'Anchor links',
		'Reading time',
		'Dark / light mode',
		'SEO metadata + sitemap',
		'Copy / view as Markdown',
		'5 pluggable search backends',
		'Accent-color theming',
		'Sub-path deploys',
		'Mermaid diagrams',
		'LaTeX math'
	];
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />

	<meta property="og:type" content="website" />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={SITE_URL} />
</svelte:head>

<main class="home">
	<!-- ============ HERO ============ -->
	<section class="hero">
		<VelvetBackground />

		<h1 class="anim" style:--i={1}>
			Make beautiful docs<br />
			with <span class="ember">Svelte</span> &amp; Markdown
		</h1>

		<p class="lede anim" style:--i={2}>
			A static site generator built on SvelteKit. You write plain Markdown and get prerendered pages
			with almost no JavaScript; when a page needs interactivity, drop a real Svelte component into
			the prose.
		</p>

		<div class="actions anim" style:--i={3}>
			<a class="btn primary" href={resolve('/docs/getting-started')}>
				Get started
				<span aria-hidden="true">→</span>
			</a>
			<a class="btn ghost" href={resolve('/docs')}>Read the docs</a>
		</div>

		<div class="terminal anim" style:--i={4}>
			<span class="pm-wrap" bind:this={pmWrapEl}>
				<button
					class="pm-toggle"
					aria-expanded={pickerOpen}
					aria-label="Install with {pm.label} — change package manager"
					onclick={() => (pickerOpen = !pickerOpen)}
				>
					<img src={pm.icon} alt="" />
				</button>
				{#if pickerOpen}
					<div class="pm-picker" role="listbox" aria-label="Package manager">
						{#each PACKAGE_MANAGERS as option (option.id)}
							<button
								role="option"
								aria-selected={option.id === pm.id}
								class:active={option.id === pm.id}
								aria-label={option.label}
								title={option.label}
								onclick={() => {
									pm = option;
									pickerOpen = false;
								}}
							>
								<img src={option.icon} alt="" />
							</button>
						{/each}
					</div>
				{/if}
			</span>
			<code>
				{installCommand}
			</code>
			<button class="copy" onclick={copyInstall} aria-label="Copy install command">
				{#if copied}
					<svg viewBox="0 0 16 16" aria-hidden="true">
						<path
							d="M13.5 4.5 6.75 11.25 3 7.5"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{:else}
					<svg viewBox="0 0 16 16" aria-hidden="true">
						<rect
							x="5.5"
							y="5.5"
							width="8"
							height="8"
							rx="1.5"
							fill="none"
							stroke="currentColor"
							stroke-width="1.4"
						/>
						<path
							d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1"
							fill="none"
							stroke="currentColor"
							stroke-width="1.4"
						/>
					</svg>
				{/if}
			</button>
			<span class="sr-only" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
		</div>

		<p class="pkg-version anim" style:--i={5}>
			<a href="https://www.npmjs.com/package/create-svocs-docs" target="_blank" rel="noreferrer">
				v{cliPkg.version} on npm
			</a>
		</p>
	</section>

	<!-- ============ BENTO FEATURES ============ -->
	<section class="bento" aria-label="Key features">
		<!-- Docs UX — big showcase card -->
		<article class="card span-4 rows-2">
			<DocTypewriter />
			<h2>A complete docs UI</h2>
			<p>
				Top nav, sidebar tree, breadcrumbs, table of contents and heading anchors, all generated
				from your file tree and ordered by one <code>_meta.json</code> file.
			</p>
		</article>

		<!-- Search -->
		<article class="card span-2">
			<div class="mock-search" aria-hidden="true">
				<div class="search-input">
					<svg viewBox="0 0 16 16">
						<circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
						<path
							d="m10.5 10.5 3 3"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
						/>
					</svg>
					<span>runes<i class="caret"></i></span>
					<kbd>⌘K</kbd>
				</div>
				<div class="search-hit">
					<b>Runes-first reactivity</b>
					<span>…theme state uses <mark>runes</mark> in .svelte.ts modules…</span>
				</div>
				<div class="search-hit dim">
					<b>Getting started</b>
					<span>…Svelte 5 <mark>runes</mark> by default…</span>
				</div>
			</div>
			<h2>Zero-config full-text search</h2>
			<p>
				Pagefind indexes every page at build time. Search runs in the browser, so there is no server
				to run and nothing to configure.
			</p>
		</article>

		<!-- Markdown + components -->
		<article class="card span-2">
			<div class="mock-code" aria-hidden="true">
				<span class="ln"><i class="c"># Rendering data</i></span>
				<span class="ln"></span>
				<span class="ln">Markdown, meet components.</span>
				<span class="ln"></span>
				<span class="ln"
					><i class="p">&lt;</i><i class="t">Chart</i> <i class="a">data</i><i class="p">=</i><i
						class="v">&#123;stats&#125;</i
					> <i class="p">/&gt;</i></span
				>
			</div>
			<h2>Markdown meets Svelte</h2>
			<p>
				Write <code>.md</code> for plain pages. Rename a file to <code>.svx</code> when it needs a live
				Svelte component in the prose.
			</p>
		</article>

		<!-- File-system routing -->
		<article class="card span-3">
			<div class="mock-tree" aria-hidden="true">
				<span class="dir">content/</span>
				<span class="row"><i class="pipe">├─</i> _meta.json <em>categories &amp; order</em></span>
				<span class="row"><i class="pipe">├─</i> introduction.md <em>→ /docs</em></span>
				<span class="row"
					><i class="pipe">├─</i> getting-started.md <em>→ /docs/getting-started</em></span
				>
				<span class="row"><i class="pipe">└─</i> <span class="dir">deployment/</span></span>
				<span class="row deep"><i class="pipe">└─</i> index.md <em>→ /docs/deployment</em></span>
			</div>
			<h2>File-system routing</h2>
			<p>Folders become routes. <code>_meta.json</code> controls titles, order and grouping.</p>
		</article>

		<!-- Runes -->
		<article class="card span-3">
			<div class="mock-code" aria-hidden="true">
				<span class="ln"
					><i class="k">let</i> open <i class="p">=</i> <i class="f">$state</i><i class="p">(</i><i
						class="k">false</i
					><i class="p">);</i></span
				>
				<span class="ln"
					><i class="k">let</i> label <i class="p">=</i> <i class="f">$derived</i><i class="p">(</i
					></span
				>
				<span class="ln">
					open <i class="p">?</i> <i class="v">'Close'</i> <i class="p">:</i>
					<i class="v">'Menu'</i></span
				>
				<span class="ln"><i class="p">);</i></span>
			</div>
			<h2>Runes-first reactivity</h2>
			<p>The theme, sidebar, and search dialog are built on Svelte 5 runes rather than stores.</p>
		</article>

		<!-- Performance stats -->
		<article class="card span-3 stats-card">
			<div class="stats" aria-hidden="true">
				<div class="stat">
					<strong>&le;100<small>KB</small></strong>
					<span>JS shipped, gzipped</span>
				</div>
				<div class="stat">
					<strong>95+</strong>
					<span>Lighthouse targets</span>
				</div>
				<div class="stat">
					<strong>~10<small>s</small></strong>
					<span>cold build, every page</span>
				</div>
			</div>
			<h2>Static export, tiny footprint</h2>
			<p>
				Every page prerendered with <code>adapter-static</code>. The Svelte compiler moves work to
				build time so readers download almost nothing.
			</p>
		</article>

		<!-- Runtimes -->
		<article class="card span-3">
			<div class="mock-runtimes" aria-hidden="true">
				<span class="rt"><i class="prompt">$</i> bun run dev</span>
				<span class="rt dim"><i class="prompt">$</i> pnpm dev</span>
				<span class="rt dim"><i class="prompt">$</i> deno task dev</span>
				<span class="rt dim"><i class="prompt">$</i> nub run dev</span>
				<span class="rt ok">➜ ready in 312ms</span>
			</div>
			<h2>Bring your own runtime</h2>
			<p>
				The same project and scripts run under Bun, pnpm, Deno, or Nub. Pick whichever toolchain
				you already use.
			</p>
		</article>

		<!-- OG social cards -->
		<article class="card span-3">
			<div class="mock-og" aria-hidden="true">
				<img src={asset('/og-card-example.png')} alt="" loading="lazy" width="1200" height="630" />
			</div>
			<h2>Social cards for every page</h2>
			<p>
				Each route gets its own branded 1200×630 preview card at build time, recolored by your
				accent. No browser, no image service.
			</p>
		</article>

		<!-- AI-ready -->
		<article class="card span-3">
			<div class="mock-code" aria-hidden="true">
				<span class="ln"><i class="c"># every site ships llms.txt</i></span>
				<span class="ln"><i class="k">GET</i> /llms.txt</span>
				<span class="ln"></span>
				<span class="ln"><i class="c"># draft pages from a real repo</i></span>
				<span class="ln"
					>bunx create-svocs-docs <i class="a">--repo</i><i class="p">=</i><i class="v"
						>owner/repo</i
					></span
				>
			</div>
			<h2>AI-ready out of the box</h2>
			<p>
				<code>llms.txt</code> and per-page Markdown endpoints ship with every site, and the CLI can draft
				a docs baseline from an existing repo.
			</p>
		</article>
	</section>

	<!-- ============ AND MORE ============ -->
	<section class="more" aria-label="More features">
		<h2>…and everything else you'd expect</h2>
		<ul>
			{#each extras as extra (extra)}
				<li>{extra}</li>
			{/each}
		</ul>
	</section>

	<!-- ============ STARTER DOCS ============ -->
	{#if data.docs.length}
		<section class="starter" aria-label="Starter pages">
			<div class="starter-head">
				<h2>Explore the starter docs</h2>
				<a href={resolve('/docs')}>View all →</a>
			</div>
			<ul>
				{#each data.docs as doc (doc.path)}
					<li>
						<a href={doc.slug ? resolve('/docs/[...slug]', { slug: doc.slug }) : resolve('/docs')}>
							<strong>{doc.title}</strong>
							{#if doc.description}
								<span>{doc.description}</span>
							{/if}
							<em aria-hidden="true">→</em>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- ============ FINAL CTA ============ -->
	<section class="cta">
		<div class="cta-glow" aria-hidden="true"></div>
		<h2>Set up your docs in a minute.</h2>
		<p>One command scaffolds a working site. Everything after that is Markdown.</p>
		<div class="actions">
			<a class="btn primary" href={resolve('/docs/getting-started')}>
				Get started
				<span aria-hidden="true">→</span>
			</a>
			<a class="btn ghost" href={resolve('/docs')}>Read the docs</a>
		</div>
	</section>
</main>

<style>
	.home {
		--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
		--radius-card: 1rem;
		--radius-inner: 0.5rem;
		/* Dedicated palette for the "editor screenshot" mockup panels;
		   overridden under [data-theme='light'] below. */
		--panel: #0e0c0c;
		--panel-soft: #191616;
		--panel-bone: #272322;
		--panel-line: #242020;
		--panel-line-strong: #393331;
		--panel-text: #d9cdc7;
		--panel-text-hi: #f5f1ef;
		--panel-dim: #948780;
		--panel-accent: #ff9066;
		--panel-accent-soft: #ff6a38;
		--panel-syntax-comment: #8a7f77;
		--panel-syntax-func: #edc6bd;
		--panel-syntax-type: #86b9e8;
		--panel-syntax-attr: #ffd9a8;
		--panel-syntax-value: #a8e6b8;
		max-width: 72rem;
		margin: 0 auto;
		padding: 0 1.25rem 5rem;
		display: grid;
		gap: 5rem;
	}

	/* Light-editor palette so the panels don't stay dark on a light page. */
	:global([data-theme='light']) .home {
		--panel: #fbf6f3;
		--panel-soft: #f2e8e3;
		--panel-bone: #e6d8d0;
		--panel-line: #ecdfd7;
		--panel-line-strong: #d9c5b9;
		--panel-text: #4a382f;
		--panel-text-hi: #1c110a;
		--panel-dim: #8c7568;
		--panel-accent: #c22e00;
		--panel-accent-soft: #a52700;
		--panel-syntax-comment: #97887b;
		--panel-syntax-func: #a8543d;
		--panel-syntax-type: #1d5c96;
		--panel-syntax-attr: #a5680a;
		--panel-syntax-value: #227a42;
	}

	.home :global(h1),
	.home h2 {
		text-wrap: balance;
	}

	.home p {
		text-wrap: pretty;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	/* ============ HERO ============ */

	.hero {
		position: relative;
		text-align: center;
		padding: 5.5rem 1rem 1rem;
		display: grid;
		justify-items: center;
	}

	.anim {
		animation: rise 640ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 90ms);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.hero h1 {
		position: relative;
		margin: 0;
		font-size: clamp(2.5rem, 7.2vw, 4.75rem);
		line-height: 1.05;
		letter-spacing: -0.03em;
		font-weight: 800;
	}

	.ember {
		background: linear-gradient(
			115deg,
			var(--accent-strong) 0%,
			var(--accent) 45%,
			var(--accent-soft) 90%
		);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.lede {
		position: relative;
		margin: 1.5rem auto 0;
		max-width: 42rem;
		font-size: clamp(1.05rem, 2vw, 1.2rem);
		line-height: 1.65;
		color: var(--text-soft);
	}

	.actions {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 2rem;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0.65rem 1.35rem;
		border-radius: 0.6rem;
		font-weight: 650;
		font-size: 0.95rem;
		text-decoration: none;
		transition:
			transform 140ms var(--ease-out),
			color 140ms var(--ease-out),
			background-color 140ms var(--ease-out);
	}

	.btn:active {
		transform: scale(0.97);
	}

	.btn.primary {
		background: linear-gradient(180deg, var(--accent-strong), var(--accent));
		color: var(--accent-contrast);
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.25),
			0 4px 14px color-mix(in srgb, var(--accent) 30%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.25);
	}

	.btn.primary span {
		transition: transform 140ms var(--ease-out);
	}

	.btn.ghost {
		color: var(--text);
		border: 1px solid var(--line-strong);
		background: color-mix(in srgb, var(--bg-soft) 72%, transparent);
	}

	@media (hover: hover) and (pointer: fine) {
		.btn.primary:hover span {
			transform: translateX(3px);
		}

		.btn.ghost:hover {
			color: var(--accent-soft);
			background: color-mix(in srgb, var(--bg-soft) 92%, transparent);
		}
	}

	.terminal {
		position: relative;
		margin-top: 2.25rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem;
		border-radius: 0.75rem;
		border: 1px solid var(--panel-line-strong);
		background: var(--panel);
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.25),
			0 8px 24px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.terminal code {
		font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
		font-size: 0.88rem;
		color: var(--panel-text);
	}

	.pm-wrap {
		position: relative;
		display: inline-flex;
	}

	.pm-toggle {
		display: grid;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		padding: 0;
		border: none;
		border-radius: 0.4rem;
		background: transparent;
		color: var(--panel-accent-soft);
		cursor: pointer;
		transition: background 120ms var(--ease-out);
	}

	.pm-toggle:hover,
	.pm-toggle[aria-expanded='true'] {
		background: var(--panel-soft);
	}

	.pm-toggle img {
		width: 1.1rem;
		height: 1.1rem;
	}

	.pm-picker {
		position: absolute;
		bottom: calc(100% + 0.65rem);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 0.25rem;
		padding: 0.3rem;
		border-radius: 0.6rem;
		border: 1px solid var(--panel-line-strong);
		background: var(--panel);
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.25),
			0 8px 24px rgba(0, 0, 0, 0.35);
		z-index: 6;
	}

	.pm-picker button {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 0.45rem;
		background: transparent;
		color: var(--panel-dim);
		cursor: pointer;
		transition:
			color 120ms var(--ease-out),
			background 120ms var(--ease-out);
	}

	.pm-picker button:hover {
		color: var(--panel-text);
		background: var(--panel-soft);
	}

	.pm-picker button.active {
		color: var(--panel-accent-soft);
		background: var(--panel-soft);
	}

	.pm-picker img {
		width: 1.15rem;
		height: 1.15rem;
	}

	.prompt {
		color: var(--panel-accent-soft);
		font-style: normal;
		margin-right: 0.25rem;
	}

	.copy {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.45rem;
		border: 1px solid var(--panel-line-strong);
		background: var(--panel-soft);
		color: var(--panel-dim);
		cursor: pointer;
		transition: color 120ms var(--ease-out);
	}

	.copy:active {
		transform: scale(0.94);
	}

	.copy svg {
		width: 1rem;
		height: 1rem;
	}

	@media (hover: hover) and (pointer: fine) {
		.copy:hover {
			color: var(--panel-accent-soft);
		}
	}

	.pkg-version {
		margin: 0.7rem 0 0;
		font-size: 0.75rem;
		letter-spacing: 0.01em;
	}

	.pkg-version a {
		color: var(--text-dim);
		text-decoration: none;
		transition: color 120ms var(--ease-out);
	}

	.pkg-version a:hover {
		color: var(--accent-soft);
	}

	/* ============ BENTO ============ */

	.bento {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 1rem;
	}

	.card {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 1.5rem;
		border-radius: var(--radius-card);
		border: 1px solid var(--line);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--bg-elev) 90%, var(--bg-soft-2)) 0%,
			var(--bg-elev) 60%
		);
		box-shadow: var(--shadow-card);
	}

	.span-2 {
		grid-column: span 2;
	}
	.span-3 {
		grid-column: span 3;
	}
	.span-4 {
		grid-column: span 4;
	}
	.rows-2 {
		grid-row: span 2;
	}

	.card h2 {
		margin: 1.15rem 0 0.4rem;
		font-size: 1.08rem;
		letter-spacing: -0.01em;
	}

	.card p {
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.6;
		color: var(--text-soft);
	}

	.card p code,
	.card h2 + p code {
		font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
		font-size: 0.85em;
		padding: 0.1em 0.35em;
		border-radius: 0.3em;
		background: var(--bg-soft);
		border: 1px solid var(--line);
		color: var(--accent-strong);
	}

	/* --- search mockup --- */

	.mock-search {
		display: grid;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: var(--radius-inner);
		border: 1px solid var(--panel-line);
		background: var(--panel);
	}

	.search-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.65rem;
		border-radius: 0.45rem;
		border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--panel-line));
		background: var(--panel-soft);
		font-size: 0.8rem;
		color: var(--panel-text-hi);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 8%, transparent);
	}

	.search-input svg {
		width: 0.85rem;
		height: 0.85rem;
		color: var(--panel-dim);
		flex-shrink: 0;
	}

	.caret {
		display: inline-block;
		width: 1px;
		height: 0.9em;
		margin-left: 1px;
		vertical-align: text-bottom;
		background: var(--panel-accent-soft);
		animation: blink 1.1s steps(2) infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	.search-input kbd {
		margin-left: auto;
		font-family: inherit;
		font-size: 0.66rem;
		color: var(--panel-dim);
		padding: 0.1rem 0.4rem;
		border-radius: 0.3rem;
		border: 1px solid var(--panel-line);
		background: var(--panel);
	}

	.search-hit {
		display: grid;
		gap: 0.15rem;
		padding: 0.5rem 0.65rem;
		border-radius: 0.45rem;
		background: var(--panel-soft);
		font-size: 0.74rem;
	}

	.search-hit.dim {
		opacity: 0.55;
	}

	.search-hit b {
		color: var(--panel-text-hi);
		font-weight: 600;
	}

	.search-hit span {
		color: var(--panel-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.search-hit mark {
		background: color-mix(in srgb, var(--accent) 28%, transparent);
		color: var(--panel-accent);
		border-radius: 0.15rem;
		padding: 0 0.1em;
	}

	/* --- code mockups --- */

	.mock-code {
		display: grid;
		align-content: start;
		gap: 0.3rem;
		padding: 0.9rem 1rem;
		border-radius: var(--radius-inner);
		border: 1px solid var(--panel-line);
		background: var(--panel);
		font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--panel-text);
		overflow-x: auto;
	}

	.ln {
		white-space: pre;
		min-height: 1.2em;
	}

	.mock-code i {
		font-style: normal;
	}

	.mock-code .c {
		color: var(--panel-syntax-comment);
	}
	.mock-code .k {
		color: var(--panel-accent-soft);
	}
	.mock-code .f {
		color: var(--panel-syntax-func);
	}
	.mock-code .p {
		color: var(--panel-dim);
	}
	.mock-code .t {
		color: var(--panel-syntax-type);
	}
	.mock-code .a {
		color: var(--panel-syntax-attr);
	}
	.mock-code .v {
		color: var(--panel-syntax-value);
	}

	/* --- file tree mockup --- */

	.mock-tree {
		display: grid;
		gap: 0.28rem;
		padding: 0.9rem 1rem;
		border-radius: var(--radius-inner);
		border: 1px solid var(--panel-line);
		background: var(--panel);
		font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
		font-size: 0.74rem;
		color: var(--panel-text);
		overflow-x: auto;
	}

	.mock-tree .dir {
		color: var(--panel-accent-soft);
		font-weight: 600;
	}

	.mock-tree .row {
		white-space: nowrap;
	}

	.mock-tree .pipe {
		color: var(--panel-line-strong);
		font-style: normal;
	}

	.mock-tree em {
		color: var(--panel-dim);
		font-style: normal;
		margin-left: 0.4rem;
	}

	/* --- stats --- */

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	.stat {
		display: grid;
		gap: 0.2rem;
		padding: 0.9rem 0.75rem;
		border-radius: var(--radius-inner);
		border: 1px solid var(--panel-line);
		background: var(--panel);
		text-align: center;
	}

	.stat strong {
		font-size: 1.5rem;
		font-weight: 750;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		color: var(--panel-accent);
	}

	.stat small {
		font-size: 0.7em;
		font-weight: 600;
		margin-left: 0.1em;
	}

	.stat span {
		font-size: 0.7rem;
		color: var(--panel-dim);
	}

	/* --- runtimes mockup --- */

	.mock-og {
		border-radius: var(--radius-inner);
		border: 1px solid var(--panel-line);
		overflow: hidden;
	}

	.mock-og img {
		display: block;
		width: 100%;
		height: auto;
	}

	.mock-runtimes {
		display: grid;
		gap: 0.4rem;
		padding: 0.9rem 1rem;
		border-radius: var(--radius-inner);
		border: 1px solid var(--panel-line);
		background: var(--panel);
		font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
		font-size: 0.78rem;
		color: var(--panel-text);
	}

	.rt.dim {
		opacity: 0.45;
	}

	.rt.ok {
		color: var(--panel-syntax-value);
	}

	/* ============ MORE ============ */

	.more {
		text-align: center;
	}

	.more h2 {
		margin: 0 0 1.25rem;
		font-size: clamp(1.3rem, 3vw, 1.7rem);
		letter-spacing: -0.02em;
	}

	.more ul {
		list-style: none;
		margin: 0 auto;
		padding: 0;
		max-width: 46rem;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
	}

	.more li {
		font-size: 0.82rem;
		font-weight: 550;
		color: var(--text-soft);
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg-elev) 80%, transparent);
	}

	/* ============ STARTER ============ */

	.starter-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.starter-head h2 {
		margin: 0;
		font-size: clamp(1.3rem, 3vw, 1.7rem);
		letter-spacing: -0.02em;
	}

	.starter-head a {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--accent-strong);
		text-decoration: none;
	}

	.starter-head a:hover {
		text-decoration: underline;
	}

	.starter ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 0.75rem;
	}

	.starter li a {
		position: relative;
		display: grid;
		gap: 0.25rem;
		height: 100%;
		padding: 1rem 2.4rem 1rem 1.1rem;
		border-radius: 0.75rem;
		border: 1px solid var(--line);
		background: var(--bg-elev);
		text-decoration: none;
		transition: transform 150ms var(--ease-out);
	}

	.starter li strong {
		color: var(--text);
		font-size: 0.95rem;
		transition: color 150ms var(--ease-out);
	}

	.starter li span {
		font-size: 0.83rem;
		line-height: 1.5;
		color: var(--text-dim);
	}

	.starter li em {
		position: absolute;
		top: 1rem;
		right: 1rem;
		font-style: normal;
		color: var(--text-dim);
		transition:
			color 150ms var(--ease-out),
			transform 150ms var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.starter li a:hover {
			transform: translateY(-2px);
		}

		.starter li a:hover strong {
			color: var(--accent-strong);
		}

		.starter li a:hover em {
			color: var(--accent-soft);
			transform: translateX(3px);
		}
	}

	/* ============ CTA ============ */

	.cta {
		position: relative;
		text-align: center;
		padding: 3.5rem 1.5rem;
		border-radius: 1.25rem;
		border: 1px solid var(--line-strong);
		background:
			radial-gradient(
				32rem 14rem at 50% 118%,
				color-mix(in srgb, var(--accent) 18%, transparent),
				transparent 72%
			),
			var(--bg-elev);
		overflow: hidden;
	}

	.cta-glow {
		position: absolute;
		left: 50%;
		bottom: -1px;
		transform: translateX(-50%);
		width: 60%;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--accent-soft), transparent);
	}

	.cta h2 {
		margin: 0;
		font-size: clamp(1.7rem, 4.5vw, 2.6rem);
		letter-spacing: -0.025em;
	}

	.cta p {
		margin: 0.75rem auto 0;
		max-width: 34rem;
		color: var(--text-soft);
	}

	.cta .actions {
		margin-top: 1.75rem;
	}

	/* ============ RESPONSIVE ============ */

	@media (max-width: 960px) {
		.bento {
			grid-template-columns: repeat(2, 1fr);
		}

		.span-2,
		.span-3,
		.span-4 {
			grid-column: span 2;
		}

		.rows-2 {
			grid-row: auto;
		}
	}

	@media (max-width: 640px) {
		.home {
			gap: 3.5rem;
		}

		.hero {
			padding-top: 3.5rem;
		}

		.hero h1 br {
			display: none;
		}

		.bento {
			grid-template-columns: 1fr;
		}

		.span-2,
		.span-3,
		.span-4 {
			grid-column: auto;
		}

		.terminal {
			max-width: 100%;
		}

		.terminal code {
			font-size: 0.78rem;
		}

		.starter-head {
			flex-direction: column;
			gap: 0.25rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.anim {
			animation: none;
		}

		.caret {
			animation: none;
		}

		.card,
		.btn,
		.starter li a,
		.starter li em {
			transition-duration: 0.01ms;
		}
	}
</style>
