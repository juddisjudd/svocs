import {
	PUBLIC_CHROMA_COLLECTION_NAME,
	PUBLIC_CHROMA_HOST,
	PUBLIC_CHROMA_PORT,
	PUBLIC_CHROMA_SSL,
	PUBLIC_CHROMA_TOKEN
} from '$app/env/public';
import { ChromaClient } from 'chromadb';
import type { SearchClient, SearchResultItem } from '../types';

type ChromaMeta = { url: string; title: string; description?: string };

export function createClient(): SearchClient {
	const host = PUBLIC_CHROMA_HOST;
	const port = Number(PUBLIC_CHROMA_PORT ?? '8000');
	const ssl = PUBLIC_CHROMA_SSL === 'true';
	const token = PUBLIC_CHROMA_TOKEN;
	const collectionName = PUBLIC_CHROMA_COLLECTION_NAME;

	return {
		async search(query: string): Promise<SearchResultItem[]> {
			if (!host || !token || !collectionName) {
				throw new Error('Chroma search is not configured. See the Search docs for setup.');
			}

			const client = new ChromaClient({
				host,
				port,
				ssl,
				headers: { Authorization: `Bearer ${token}` }
			});

			const collection = await client.getCollection({ name: collectionName });
			const results = await collection.query<ChromaMeta>({
				queryTexts: [query],
				nResults: 8
			});

			const rows = results.rows()[0] ?? [];

			return rows.map((row) => {
				const meta = row.metadata;
				const excerpt = meta?.description || (row.document ?? '').slice(0, 160);
				return {
					id: row.id,
					url: meta?.url ?? '',
					title: meta?.title ?? '',
					excerpt
				} satisfies SearchResultItem;
			});
		}
	};
}
