import { PUBLIC_SVOCS_SEARCH_PROVIDER } from '$env/static/public';
import type { SearchClient } from './types';

let cached: SearchClient | undefined;

/**
 * Resolves the active search backend. The switch must stay on the
 * $env/static/public constant with literal-string imports so the bundler
 * drops unselected branches — a broken dep in an unused provider would
 * otherwise fail every build.
 */
export async function getSearchClient(): Promise<SearchClient> {
	if (cached) {
		return cached;
	}

	switch (PUBLIC_SVOCS_SEARCH_PROVIDER) {
		case 'orama':
			cached = (await import('./providers/orama-client')).createClient();
			break;
		case 'flexsearch':
			cached = (await import('./providers/flexsearch-client')).createClient();
			break;
		case 'typesense':
			cached = (await import('./providers/typesense-client')).createClient();
			break;
		case 'chroma':
			cached = (await import('./providers/chroma-client')).createClient();
			break;
		default:
			cached = (await import('./providers/pagefind-client')).createClient();
	}

	return cached;
}
