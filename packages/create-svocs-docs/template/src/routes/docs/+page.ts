import type { PageLoad } from './$types';
import { getDocEntryBySlug, getDocTocBySlug } from '$lib/core/content';

export const prerender = true;

export const load: PageLoad = async () => {
	const entry = getDocEntryBySlug(['introduction']);

	if (!entry) {
		throw new Error('Missing starter document: introduction');
	}

	return {
		entry,
		toc: getDocTocBySlug(['introduction'])
	};
};
