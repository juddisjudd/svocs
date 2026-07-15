import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = async () => {
	if (env.PUBLIC_SVOCS_SEARCH_PROVIDER !== 'flexsearch') {
		error(404, 'FlexSearch is not enabled for this site.');
	}

	const { buildFlexSearchIndex } = await import('$lib/search/providers/flexsearch-indexer');
	const chunks = await buildFlexSearchIndex();

	return json(chunks);
};
