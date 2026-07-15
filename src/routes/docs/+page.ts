import type { PageLoad } from './$types';
import { getDocEntryBySlug, getDocTocBySlug } from '$lib/core/content';

export const prerender = true;

export const load: PageLoad = async () => {
	const entry = getDocEntryBySlug(['getting-started']);

	if (!entry) {
		throw new Error('Missing starter document: getting-started');
	}

	return {
		entry,
		toc: getDocTocBySlug(['getting-started'])
	};
};
