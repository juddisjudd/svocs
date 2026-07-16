import { error, text } from '@sveltejs/kit';
import { getDocEntryBySlug, getDocsEntries, getRawMarkdownBySlug } from '$lib/core/content';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

// Explicit entries so every doc gets its .md file without depending on the
// prerender crawler finding the "View as Markdown" links.
export const entries: EntryGenerator = () => {
	return getDocsEntries().map((entry) => ({ slug: entry.slug }));
};

export const GET: RequestHandler = async ({ params }) => {
	const slugParts = params.slug.split('/');
	const entry = getDocEntryBySlug(slugParts);
	const raw = getRawMarkdownBySlug(slugParts);

	if (!entry || raw === null) {
		error(404, `Document not found: ${slugParts.join('/')}`);
	}

	return text(raw, {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
};
