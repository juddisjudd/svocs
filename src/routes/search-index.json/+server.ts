import { json } from '@sveltejs/kit';
import { getAllSearchDocuments } from '$lib/core/content';
import type { RequestHandler } from './$types';

export const prerender = true;

// Always built, regardless of the active search provider — this is the
// canonical raw-content feed for anything that runs AFTER `vite build`
// (the Typesense/Chroma sync scripts read this file straight off disk at
// build/search-index.json instead of re-parsing content/ themselves).
export const GET: RequestHandler = async () => {
	return json(getAllSearchDocuments());
};
