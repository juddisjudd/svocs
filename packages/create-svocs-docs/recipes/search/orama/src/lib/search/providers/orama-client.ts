import { base } from '$app/paths';
import { create, insertMultiple, search, type AnyOrama } from '@orama/orama';
import type { SearchClient, SearchResultItem } from '../types';
import type { OramaDoc } from './orama-indexer';

export function createClient(): SearchClient {
	let dbPromise: Promise<AnyOrama> | null = null;

	async function ensureLoaded(): Promise<AnyOrama> {
		if (!dbPromise) {
			dbPromise = fetch(`${base}/search-index.orama.json`)
				.then(async (res) => {
					if (!res.ok) {
						throw new Error('Search index is not available yet. Run bun run build first.');
					}
					return (await res.json()) as OramaDoc[];
				})
				.then(async (docs) => {
					const db = create({
						schema: { id: 'string', url: 'string', title: 'string', content: 'string' } as const
					});
					await insertMultiple(db, docs);
					return db;
				});
		}
		return dbPromise;
	}

	return {
		async search(query: string): Promise<SearchResultItem[]> {
			const db = await ensureLoaded();
			const results = await search(db, { term: query, limit: 8 });

			return results.hits.map((hit) => {
				const doc = hit.document as OramaDoc;
				return {
					id: doc.id,
					url: doc.url,
					title: doc.title,
					excerpt: doc.content.length > 160 ? `${doc.content.slice(0, 160)}…` : doc.content
				} satisfies SearchResultItem;
			});
		}
	};
}
