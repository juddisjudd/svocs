import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

export const prerender = true;

// Prerendered regardless of the active backend so the build never depends
// on which provider is selected, but the raw documents are only ever
// computed when actually needed — other deployments never pay for this.
export const GET: RequestHandler = async () => {
	if (env.PUBLIC_SVOCS_SEARCH_PROVIDER !== 'orama') {
		error(404, 'Orama search is not enabled for this site.');
	}

	const { buildOramaDocuments } = await import('$lib/search/providers/orama-indexer');
	return json(buildOramaDocuments());
};
