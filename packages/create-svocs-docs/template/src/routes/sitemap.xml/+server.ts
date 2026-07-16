import { SitemapStream, streamToPromise } from 'sitemap';
import { getDocsEntries } from '$lib/core/content';
import { SITE_URL } from '$lib/site';
import type { RequestHandler } from './$types';

export const prerender = true;

// Routes outside content/, which getDocsEntries() can't see.
const STATIC_ROUTES = ['/', '/docs'];

const EMPTY_SITEMAP = '<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>';

async function buildSitemap(): Promise<string> {
	// Sitemaps require absolute URLs; with SITE_URL unset, ship an empty but
	// valid sitemap instead of failing the build.
	if (!SITE_URL) {
		return EMPTY_SITEMAP;
	}

	const stream = new SitemapStream({ hostname: SITE_URL });

	for (const path of STATIC_ROUTES) {
		stream.write({ url: path });
	}
	for (const doc of getDocsEntries()) {
		stream.write({ url: doc.path });
	}
	stream.end();

	return (await streamToPromise(stream)).toString();
}

export const GET: RequestHandler = async () => {
	return new Response(await buildSitemap(), {
		headers: { 'content-type': 'application/xml' }
	});
};
