import { resolve } from '$app/paths';
import { createDocumentIndex } from './flexsearch-config';
import { groupRecords, type SearchRecord } from '../records';
import type { SearchClient, SearchResultItem } from '../types';

const FIELD_RANK = ['title', 'heading', 'content'] as const;

export function createClient(): SearchClient {
	let indexPromise: Promise<ReturnType<typeof createDocumentIndex>> | null = null;

	async function ensureLoaded() {
		if (!indexPromise) {
			indexPromise = fetch(resolve('/search-index.flexsearch.json'))
				.then(async (res) => {
					if (!res.ok) {
						throw new Error('Search index is not available yet. Run bun run build first.');
					}
					return (await res.json()) as Record<string, string>;
				})
				.then(async (chunks) => {
					const index = createDocumentIndex();
					for (const [key, data] of Object.entries(chunks)) {
						index.import(key, data);
					}
					return index;
				});
		}
		return indexPromise;
	}

	return {
		async search(query: string): Promise<SearchResultItem[]> {
			const index = await ensureLoaded();
			const byField = index.search(query, { index: [...FIELD_RANK], enrich: true, limit: 40 });

			// FlexSearch has no field boosts, so title hits rank first, then heading hits, then body hits.
			const hits = new Map<string, SearchRecord>();
			for (const { result } of byField.toSorted(
				(a, b) =>
					FIELD_RANK.indexOf(a.field as (typeof FIELD_RANK)[number]) -
					FIELD_RANK.indexOf(b.field as (typeof FIELD_RANK)[number])
			)) {
				for (const hit of result) {
					if (hit.doc && !hits.has(String(hit.id))) {
						hits.set(String(hit.id), hit.doc as SearchRecord);
					}
				}
			}
			return groupRecords([...hits.values()], query);
		}
	};
}
