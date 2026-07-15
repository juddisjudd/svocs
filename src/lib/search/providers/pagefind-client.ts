import { base } from '$app/paths';
import type { SearchClient, SearchResultItem } from '../types';

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

export function createClient(): SearchClient {
	let pagefind: PagefindSearch | null = null;

	async function ensureLoaded(): Promise<PagefindSearch> {
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
			throw new Error('Search index is not available yet. Run bun run build first.');
		}
	}

	return {
		async search(query: string): Promise<SearchResultItem[]> {
			const api = await ensureLoaded();
			const response = await api.search(query, { limit: 8 });

			return Promise.all(
				response.results.map(async (result) => {
					const data = await result.data();
					return {
						id: result.id,
						url: data.url,
						title: data.meta.title,
						excerpt: data.excerpt
					} satisfies SearchResultItem;
				})
			);
		}
	};
}
