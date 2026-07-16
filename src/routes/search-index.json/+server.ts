import { json } from '@sveltejs/kit';
import { getAllSearchDocuments } from '$lib/core/content';
import type { RequestHandler } from './$types';

export const prerender = true;

// Always built regardless of provider; post-build sync scripts read this
// file off disk instead of re-parsing content/.
export const GET: RequestHandler = async () => {
	return json(getAllSearchDocuments());
};
