import { error } from '@sveltejs/kit';
import { PUBLIC_SVOCS_SEARCH_PROVIDER } from '$app/env/public';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = async () => {
	if (PUBLIC_SVOCS_SEARCH_PROVIDER !== 'flexsearch') {
		error(404, 'FlexSearch is not enabled for this site.');
	}

	const { buildFlexSearchIndex } = await import('#lib/search/providers/flexsearch-indexer.js');
	const chunks = await buildFlexSearchIndex();

	return Response.json(chunks);
};
