<script lang="ts">
	import { browser } from '$app/environment';
	import { getSearchClient } from '$lib/search/resolver';
	import type { SearchResultItem } from '$lib/search/types';

	let dialogEl: HTMLDialogElement | undefined = $state();
	let query = $state('');
	let loading = $state(false);
	let errorMessage = $state('');
	let results = $state<SearchResultItem[]>([]);
	let activeIndex = $state(-1);

	let inputEl: HTMLInputElement | undefined = $state();

	export function open() {
		dialogEl?.showModal();
		requestAnimationFrame(() => inputEl?.focus());
	}

	function reset() {
		query = '';
		results = [];
		errorMessage = '';
		loading = false;
		activeIndex = -1;
	}

	async function runSearch(term: string): Promise<void> {
		const normalized = term.trim();
		if (!normalized) {
			results = [];
			errorMessage = '';
			activeIndex = -1;
			return;
		}

		loading = true;
		errorMessage = '';

		try {
			const client = await getSearchClient();
			results = await client.search(normalized);
			activeIndex = results.length > 0 ? 0 : -1;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to run search right now.';
			results = [];
			activeIndex = -1;
		} finally {
			loading = false;
		}
	}

	let debounceHandle: ReturnType<typeof setTimeout> | null = null;

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

	function toPlainText(input: string): string {
		return input
			.replace(/<[^>]+>/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function goToResult(url: string) {
		dialogEl?.close();
		if (browser) {
			window.location.assign(url);
		}
	}

	function onInputKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (results.length > 0) {
				activeIndex = (activeIndex + 1) % results.length;
			}
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (results.length > 0) {
				activeIndex = (activeIndex - 1 + results.length) % results.length;
			}
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const active = results[activeIndex];
			if (active) {
				goToResult(active.url);
			}
		}
	}

	function onDialogClick(event: MouseEvent) {
		// A click on the <dialog> element itself is a backdrop click.
		if (event.target === dialogEl) {
			dialogEl?.close();
		}
	}

	const resultId = (index: number) => `search-result-${index}`;
</script>

<dialog
	bind:this={dialogEl}
	class="search-dialog"
	onclick={onDialogClick}
	onclose={reset}
	aria-label="Search documentation"
>
	<div class="panel">
		<div class="input-row">
			<svg viewBox="0 0 16 16" aria-hidden="true">
				<circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
				<path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
			</svg>
			<input
				bind:this={inputEl}
				type="search"
				role="combobox"
				aria-expanded={results.length > 0}
				aria-controls="search-results"
				aria-activedescendant={activeIndex >= 0 ? resultId(activeIndex) : undefined}
				autocomplete="off"
				placeholder="Search pages"
				bind:value={query}
				onkeydown={onInputKeydown}
			/>
			<kbd>Esc</kbd>
		</div>

		<div class="results" aria-live="polite">
			{#if loading}
				<p class="status">Searching...</p>
			{:else if errorMessage}
				<p class="status error">{errorMessage}</p>
			{:else if results.length > 0}
				<ul id="search-results" role="listbox">
					{#each results as result, i (result.id)}
						<li id={resultId(i)} role="option" aria-selected={i === activeIndex}>
							<button
								type="button"
								class:active={i === activeIndex}
								onmouseenter={() => (activeIndex = i)}
								onclick={() => goToResult(result.url)}
							>
								<strong>{result.title}</strong>
								<span>{toPlainText(result.excerpt)}</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else if query.trim()}
				<p class="status">No results</p>
			{:else}
				<p class="status">Start typing to search the docs</p>
			{/if}
		</div>
	</div>
</dialog>

<style>
	.search-dialog {
		width: min(34rem, calc(100vw - 2rem));
		padding: 0;
		border: 1px solid var(--line-strong);
		border-radius: 0.85rem;
		background: var(--bg-elev);
		color: var(--text);
		box-shadow: var(--shadow-lift);
		overflow: hidden;
	}

	.search-dialog::backdrop {
		background: color-mix(in srgb, var(--bg) 60%, transparent);
		backdrop-filter: blur(12px);
	}

	.panel {
		display: grid;
		grid-template-rows: auto 1fr;
		max-height: min(28rem, 70vh);
	}

	.input-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--line);
	}

	.input-row svg {
		width: 1.05rem;
		height: 1.05rem;
		color: var(--text-dim);
		flex-shrink: 0;
	}

	.input-row input {
		flex: 1;
		min-width: 0;
		border: none;
		background: transparent;
		color: var(--text);
		font-size: 1rem;
		outline: none;
	}

	.input-row input::placeholder {
		color: var(--muted);
	}

	.input-row kbd {
		font-family: inherit;
		font-size: 0.72rem;
		color: var(--text-dim);
		padding: 0.15rem 0.45rem;
		border-radius: 0.35rem;
		border: 1px solid var(--line-strong);
		background: var(--bg-soft);
	}

	.results {
		overflow-y: auto;
		padding: 0.5rem;
	}

	.status {
		margin: 0;
		padding: 1.25rem 0.7rem;
		text-align: center;
		font-size: 0.88rem;
		color: var(--muted);
	}

	.status.error {
		color: var(--danger);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.3rem;
	}

	button {
		width: 100%;
		text-align: left;
		border: 1px solid transparent;
		background: transparent;
		border-radius: 0.55rem;
		padding: 0.55rem 0.65rem;
		display: grid;
		gap: 0.2rem;
		cursor: pointer;
		color: var(--text);
	}

	button.active,
	button:hover {
		background: color-mix(in srgb, var(--bg-soft-2) 84%, transparent);
	}

	button.active strong,
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
