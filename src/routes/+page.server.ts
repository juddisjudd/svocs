import type { PageServerLoad } from './$types';
import { getDocsEntries } from '$lib/core/content';

export const prerender = true;

// Curated by hand: getDocsEntries()'s per-directory `order` isn't a
// meaningful global ranking to slice from.
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
