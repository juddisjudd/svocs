import { resolve } from '$app/paths';
import type { SearchClient, SearchResultItem } from '../types';

type PagefindSubResult = {
	title: string;
	url: string;
	excerpt: string;
	weighted_locations: { balanced_score: number }[];
};

type PagefindSearch = {
	search: (
		term: string,
		opts?: { limit?: number }
	) => Promise<{
		results: Array<{
			id: string;
			data: () => Promise<{
				url: string;
				meta: { title: string };
				excerpt: string;
				sub_results: PagefindSubResult[];
			}>;
		}>;
	}>;
};

const MAX_SECTIONS_PER_PAGE = 3;

// Pagefind indexes the prerendered files, so its URLs end in .html; the site links without it.
const cleanUrl = (url: string) => url.replace(/\.html(?=#|$)/, '');

const score = (sub: PagefindSubResult) =>
	sub.weighted_locations.reduce((sum, location) => sum + location.balanced_score, 0);

export function createClient(): SearchClient {
	let pagefind: PagefindSearch | null = null;

	async function ensureLoaded(): Promise<PagefindSearch> {
		if (pagefind) {
			return pagefind;
		}

		try {
			const mod = (await import(
				/* @vite-ignore */ `${resolve('/')}pagefind/pagefind.js`
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
				response.results.slice(0, 8).map(async (result) => {
					const data = await result.data();
					const sections = data.sub_results
						.filter((sub) => sub.url.includes('#'))
						.sort((a, b) => score(b) - score(a))
						.slice(0, MAX_SECTIONS_PER_PAGE)
						.map((sub) => ({ url: cleanUrl(sub.url), title: sub.title, excerpt: sub.excerpt }));
					return {
						id: result.id,
						url: cleanUrl(data.url),
						title: data.meta.title,
						excerpt: data.excerpt,
						sections
					} satisfies SearchResultItem;
				})
			);
		}
	};
}
