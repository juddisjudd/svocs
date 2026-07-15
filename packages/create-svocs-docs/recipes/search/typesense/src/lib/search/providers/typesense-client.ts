import { env } from '$env/dynamic/public';
import { SearchClient as TypesenseSearchClient } from 'typesense';
import type { SearchClient, SearchResultItem } from '../types';

type TypesenseDoc = { id: string; url: string; title: string; content: string };

export function createClient(): SearchClient {
	const host = env.PUBLIC_TYPESENSE_HOST;
	const port = Number(env.PUBLIC_TYPESENSE_PORT ?? '443');
	const protocol = env.PUBLIC_TYPESENSE_PROTOCOL ?? 'https';
	const apiKey = env.PUBLIC_TYPESENSE_SEARCH_API_KEY;
	const collectionName = env.PUBLIC_TYPESENSE_COLLECTION_NAME;

	const client = new TypesenseSearchClient({
		nodes: [{ host: host ?? '', port, protocol }],
		apiKey: apiKey ?? '',
		connectionTimeoutSeconds: 5
	});

	return {
		async search(query: string): Promise<SearchResultItem[]> {
			if (!host || !apiKey || !collectionName) {
				throw new Error('Typesense search is not configured. See the Search docs for setup.');
			}

			const results = await client
				.collections<TypesenseDoc>(collectionName)
				.documents()
				.search({ q: query, query_by: 'title,content', per_page: 8 }, {});

			return (results.hits ?? []).map((hit) => {
				const doc = hit.document;
				const highlight = hit.highlight?.content?.snippet;
				return {
					id: doc.id,
					url: doc.url,
					title: doc.title,
					excerpt: highlight ?? doc.content.slice(0, 160)
				} satisfies SearchResultItem;
			});
		}
	};
}
