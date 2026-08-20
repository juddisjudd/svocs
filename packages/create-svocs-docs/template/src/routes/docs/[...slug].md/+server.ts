import { error, text } from '@sveltejs/kit';
import { getDocEntryBySlug, getDocsEntries, getRawMarkdownBySlug } from '$lib/server/content';
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
	const body = getRawMarkdownBySlug(slugParts);

	if (!entry || body === null) {
		error(404, `Document not found: ${slugParts.join('/')}`);
	}

	// The layout renders title and description from metadata; the exported
	// markdown carries them inline so it stands alone.
	const header = [`# ${entry.title}`, entry.description ? `\n> ${entry.description}` : '']
		.filter(Boolean)
		.join('\n');

	return text(`${header}\n\n${body.trim()}\n`, {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
};
