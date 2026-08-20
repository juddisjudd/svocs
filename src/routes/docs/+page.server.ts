import type { PageServerLoad } from './$types';
import { getDocEntryBySlug, getDocsEntries, getDocTocBySlug } from '$lib/server/content';

export const prerender = true;

/**
 * /docs lands on the introduction page when one exists, otherwise the
 * content root's index page, otherwise the first page in sidebar order —
 * so renaming or replacing the starter content never breaks the route.
 */
export const load: PageServerLoad = async () => {
	const entry =
		getDocEntryBySlug(['introduction']) ?? getDocEntryBySlug(['']) ?? getDocsEntries()[0];

	if (!entry) {
		throw new Error('No content found: add a markdown file under content/.');
	}

	return {
		entry,
		toc: getDocTocBySlug(entry.slug.split('/'))
	};
};
