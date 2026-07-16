import type { PageServerLoad } from './$types';
import { getDocsEntries } from '$lib/core/content';

export const prerender = true;

// getDocsEntries() sorts by an `order` field that's scored per-directory
// (so nested sections can be reordered independently in the sidebar) — it
// isn't a meaningful global ranking once flattened. Curate the homepage
// teaser explicitly instead of slicing that list, so it stays representative
// of the docs as they grow rather than an artifact of directory structure.
const FEATURED_DOC_SLUGS = [
	'introduction',
	'getting-started',
	'components',
	'theming',
	'search',
	'ai',
	'repo-analysis',
	'deployment'
];

export const load: PageServerLoad = async () => {
	const bySlug = new Map(getDocsEntries().map((doc) => [doc.slug, doc]));
	const docs = FEATURED_DOC_SLUGS.map((slug) => bySlug.get(slug)).filter(
		(doc) => doc !== undefined
	);

	return { docs };
};
