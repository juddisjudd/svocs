import type { PageServerLoad } from './$types';
import { getDocsEntries } from '$lib/core/content';

export const prerender = true;

export const load: PageServerLoad = async () => {
	const docs = getDocsEntries();

	return {
		docs: docs.slice(0, 8)
	};
};
