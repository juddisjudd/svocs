import { PUBLIC_SVOCS_SEARCH_PROVIDER } from '$env/static/public';
import type { SearchClient } from './types';

let cached: SearchClient | undefined;

/**
 * Resolves the active search backend behind one function call, so
 * SearchDialog never needs backend-specific knowledge. Pagefind is the
 * only backend wired up here — see https://svocs.dev/docs/search for how
 * to add Orama, FlexSearch, Typesense, or Chroma: install the one package
 * it needs, drop in its provider file, and add a case here.
 */
export async function getSearchClient(): Promise<SearchClient> {
	if (cached) {
		return cached;
	}

	switch (PUBLIC_SVOCS_SEARCH_PROVIDER) {
		default:
			cached = (await import('./providers/pagefind-client')).createClient();
	}

	return cached;
}
