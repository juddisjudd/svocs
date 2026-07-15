import { error, text } from '@sveltejs/kit';
import { getDocEntryBySlug, getDocsEntries, getRawMarkdownBySlug } from '$lib/core/content';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

// Explicit entries rather than relying on the prerender crawler to
// discover these via the "View as Markdown" page-action links — every doc
// gets its .md file regardless of whether that link markup ever changes.
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
