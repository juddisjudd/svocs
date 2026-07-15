import { PUBLIC_SVOCS_SEARCH_PROVIDER } from '$env/static/public';
import type { SearchClient } from './types';

let cached: SearchClient | undefined;

/**
 * Resolves the active search backend behind one function call, so
 * SearchDialog never needs backend-specific knowledge. Each branch is a
 * literal-string dynamic import so a bundler can dead-code-eliminate every
 * unreachable branch entirely — not just skip fetching its chunk, but skip
 * resolving its module graph too. That matters beyond bundle size: a
 * provider with a broken transitive dependency (chromadb's optional
 * @chroma-core/default-embed, for one) would otherwise fail every build
 * regardless of which provider is actually selected, since a non-constant
 * discriminant forces the bundler to still resolve every branch.
 *
 * $env/static/public (not /dynamic/public) is what makes the discriminant
 * a real compile-time constant — vite.config.ts defaults
 * PUBLIC_SVOCS_SEARCH_PROVIDER to 'pagefind' so the static import always
 * has a value to resolve, keeping the zero-config default working.
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
