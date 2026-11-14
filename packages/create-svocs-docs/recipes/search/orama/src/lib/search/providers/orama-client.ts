import { resolve } from '$app/paths';
import { create, insertMultiple, search, type AnyOrama } from '@orama/orama';
import { groupRecords, type SearchRecord } from '../records';
import type { SearchClient, SearchResultItem } from '../types';

export function createClient(): SearchClient {
	let dbPromise: Promise<AnyOrama> | null = null;

	async function ensureLoaded(): Promise<AnyOrama> {
		if (!dbPromise) {
			dbPromise = fetch(resolve('/search-index.orama.json'))
				.then(async (res) => {
					if (!res.ok) {
						throw new Error('Search index is not available yet. Run bun run build first.');
					}
					return (await res.json()) as SearchRecord[];
				})
				.then(async (records) => {
					const db = create({
						schema: {
							id: 'string',
							page: 'string',
							pageTitle: 'string',
							url: 'string',
							title: 'string',
							heading: 'string',
							content: 'string'
						} as const
					});
					await insertMultiple(db, records);
					return db;
				});
		}
		return dbPromise;
	}

	return {
		async search(query: string): Promise<SearchResultItem[]> {
			const db = await ensureLoaded();
			const results = await search(db, {
				term: query,
				properties: ['title', 'heading', 'content'],
				boost: { title: 3, heading: 2 },
				limit: 40
			});

			return groupRecords(
				results.hits.map((hit) => hit.document as SearchRecord),
				query
			);
		}
	};
}
