import { text } from '@sveltejs/kit';
import { getAllLlmsDocuments } from '$lib/core/content';
import { SITE_URL } from '$lib/site';
import type { RequestHandler } from './$types';

export const prerender = true;

function buildFullText(): string {
	return getAllLlmsDocuments()
		.map((doc) => {
			const header = [`# ${doc.title}`, `Source: ${SITE_URL}${doc.url}`];
			if (doc.description) {
				header.push(doc.description);
			}
			return `${header.join('\n')}\n\n${doc.raw.trim()}`;
		})
		.join('\n\n---\n\n');
}

export const GET: RequestHandler = async () => {
	return text(buildFullText(), {
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
};
