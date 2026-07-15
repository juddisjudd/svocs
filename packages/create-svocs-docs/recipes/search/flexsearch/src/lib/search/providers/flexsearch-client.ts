import { base } from '$app/paths';
import { createDocumentIndex, type FlexDoc } from './flexsearch-config';
import type { SearchClient, SearchResultItem } from '../types';

export function createClient(): SearchClient {
	let indexPromise: Promise<ReturnType<typeof createDocumentIndex>> | null = null;

	async function ensureLoaded() {
		if (!indexPromise) {
			indexPromise = fetch(`${base}/search-index.flexsearch.json`)
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
			const results = index.search(query, { enrich: true, merge: true, limit: 8 });

			return results.map((hit) => {
				const doc = hit.doc as FlexDoc | null;
				return {
					id: String(hit.id),
					url: doc?.url ?? '',
					title: doc?.title ?? '',
					excerpt: doc?.excerpt ?? ''
				} satisfies SearchResultItem;
			});
		}
	};
}
