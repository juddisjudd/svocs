import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getDocEntryBySlug, getDocTocBySlug } from '$lib/core/content';

export const prerender = true;

export const load: PageLoad = async ({ params }) => {
	const slugParts = params.slug.split('/');
	const entry = getDocEntryBySlug(slugParts);

	if (!entry) {
		throw error(404, `Document not found: ${slugParts.join('/')}`);
	}

	return {
		entry,
		toc: getDocTocBySlug(slugParts)
	};
};
