import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import { getDocEntryBySlug, getDocsEntries, getDocTocBySlug } from '#lib/server/content.js';

export const prerender = true;

// Explicit entries so pages nothing links to, such as hidden ones, are still prerendered.
export const entries: EntryGenerator = () =>
	getDocsEntries()
		.filter((entry) => entry.slug)
		.map((entry) => ({ slug: entry.slug }));

export const load: PageServerLoad = async ({ params }) => {
	const slugParts = params.slug.split('/');
	const entry = getDocEntryBySlug(slugParts);

	if (!entry) {
		error(404, `Document not found: ${slugParts.join('/')}`);
	}

	return {
		entry,
		toc: getDocTocBySlug(slugParts)
	};
};
