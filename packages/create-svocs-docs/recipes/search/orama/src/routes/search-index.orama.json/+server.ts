import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

export const prerender = true;

// Prerendered regardless of backend; documents are only computed when needed.
export const GET: RequestHandler = async () => {
	if (env.PUBLIC_SVOCS_SEARCH_PROVIDER !== 'orama') {
		error(404, 'Orama search is not enabled for this site.');
	}

	const { buildOramaDocuments } = await import('$lib/search/providers/orama-indexer');
	return json(buildOramaDocuments());
};
