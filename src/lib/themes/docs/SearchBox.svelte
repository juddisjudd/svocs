<script lang="ts">
	import { browser } from '$app/environment';
	import { base } from '$app/paths';

	type SearchResult = {
		id: string;
		url: string;
		title: string;
		excerpt: string;
	};

	type PagefindSearch = {
		search: (
			term: string,
			opts?: { limit?: number }
		) => Promise<{
			results: Array<{
				id: string;
				data: () => Promise<{ url: string; meta: { title: string }; excerpt: string }>;
			}>;
		}>;
	};

	let { compact = false }: { compact?: boolean } = $props();

	let query = $state('');
	let loading = $state(false);
	let errorMessage = $state('');
	let results = $state<SearchResult[]>([]);
	let pagefind = $state<PagefindSearch | null>(null);

	async function ensurePagefindLoaded(): Promise<PagefindSearch | null> {
		if (!browser) {
			return null;
		}

		if (pagefind) {
			return pagefind;
		}

		try {
			const mod = (await import(
				/* @vite-ignore */ `${base}/pagefind/pagefind.js`
			)) as PagefindSearch;
			pagefind = mod;
			return mod;
		} catch {
			errorMessage = 'Search index is not available yet. Run bun run build first.';
			return null;
		}
	}

	async function runSearch(term: string): Promise<void> {
		const normalized = term.trim();
		if (!normalized) {
			results = [];
			errorMessage = '';
			return;
		}

		const api = await ensurePagefindLoaded();
		if (!api) {
			results = [];
			return;
		}

		loading = true;
		errorMessage = '';

		try {
			const response = await api.search(normalized, { limit: 8 });
			const mapped = await Promise.all(
				response.results.map(async (result) => {
					const data = await result.data();
					return {
						id: result.id,
						url: data.url,
						title: data.meta.title,
						excerpt: data.excerpt
					} as SearchResult;
				})
			);

			results = mapped;
		} catch {
			errorMessage = 'Unable to run search right now.';
			results = [];
		} finally {
			loading = false;
		}
	}

	let debounceHandle: ReturnType<typeof setTimeout> | null = null;

	function toPlainText(input: string): string {
		return input
			.replace(/<[^>]+>/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	$effect(() => {
		const current = query;
		if (debounceHandle) {
			clearTimeout(debounceHandle);
		}

		debounceHandle = setTimeout(() => {
			void runSearch(current);
		}, 120);

		return () => {
			if (debounceHandle) {
				clearTimeout(debounceHandle);
			}
		};
	});

	async function openResult(url: string): Promise<void> {
		if (browser) {
			window.location.assign(url);
		}
		query = '';
		results = [];
	}
</script>

<section class="search" class:compact aria-label="Search documentation">
	<label for="docs-search">Search docs</label>
	<input
		id="docs-search"
		type="search"
		placeholder="Search pages"
		bind:value={query}
		autocomplete="off"
	/>

	{#if loading || errorMessage || query.trim()}
		<div class="results-panel" aria-live="polite">
			{#if loading}
				<p class="status">Searching...</p>
			{:else if errorMessage}
				<p class="status error">{errorMessage}</p>
			{:else if results.length > 0}
				<ul>
					{#each results as result (result.id)}
						<li>
							<button type="button" onclick={() => void openResult(result.url)}>
								<strong>{result.title}</strong>
								<span>{toPlainText(result.excerpt)}</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else if query.trim()}
				<p class="status">No results</p>
			{/if}
		</div>
	{/if}
</section>

<style>
	.search {
		display: grid;
		gap: 0.45rem;
		margin-bottom: 0.9rem;
		position: relative;
	}

	.search.compact {
		margin-bottom: 0;
	}

	label {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	.search.compact label {
		display: none;
	}

	input {
		width: 100%;
		padding: 0.55rem 0.65rem;
		border-radius: 0.5rem;
		border: 1px solid transparent;
		background: color-mix(in srgb, var(--bg-soft) 55%, transparent);
		color: var(--text-soft);
		outline: none;
		/* Dim at rest, full brightness while focused/typing — no border or
		   outline ring; the site-wide focus-visible outline is switched off
		   below since it doesn't fit this treatment. */
		opacity: 0.7;
		transition:
			opacity 0.18s ease,
			background-color 0.18s ease,
			color 0.18s ease;
	}

	input:hover {
		opacity: 0.85;
	}

	input:focus,
	input:focus-visible {
		opacity: 1;
		background: color-mix(in srgb, var(--bg-soft) 92%, transparent);
		color: var(--text);
		outline: none;
	}

	input::placeholder {
		color: var(--muted);
	}

	/* Absolutely positioned so status text and results never push header
	   layout around — the input's own row height never changes. */
	.results-panel {
		position: absolute;
		top: calc(100% + 0.4rem);
		left: 0;
		right: 0;
		z-index: 30;
	}

	.status {
		margin: 0;
		padding: 0.55rem 0.7rem;
		font-size: 0.85rem;
		color: var(--muted);
		background: var(--bg-elev);
		border: 1px solid var(--line-strong);
		border-radius: 0.6rem;
		box-shadow: var(--shadow-lift);
	}

	.status.error {
		color: var(--danger);
	}

	ul {
		list-style: none;
		padding: 0.45rem;
		margin: 0;
		display: grid;
		gap: 0.45rem;
		background: var(--bg-elev);
		border: 1px solid var(--line-strong);
		border-radius: 0.6rem;
		box-shadow: var(--shadow-lift);
	}

	button {
		width: 100%;
		text-align: left;
		border: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg-soft) 88%, transparent);
		border-radius: 0.55rem;
		padding: 0.5rem 0.6rem;
		display: grid;
		gap: 0.2rem;
		cursor: pointer;
		color: var(--text);
	}

	button:hover {
		background: color-mix(in srgb, var(--bg-soft-2) 84%, transparent);
	}

	button:hover strong {
		color: var(--accent-soft);
	}

	strong {
		font-size: 0.92rem;
		transition: color 120ms ease;
	}

	span {
		font-size: 0.84rem;
		color: var(--muted);
	}
</style>
