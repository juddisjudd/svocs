import { SitemapStream, streamToPromise } from 'sitemap';
import { getDocsEntries } from '$lib/core/content';
import { SITE_URL } from '$lib/site';
import type { RequestHandler } from './$types';

export const prerender = true;

// Static routes that exist outside content/ — /docs itself has its own
// +page.svelte (a landing page, not a content/ file), so it isn't part of
// getDocsEntries() and has to be listed by hand alongside the others.
const STATIC_ROUTES = ['/', '/docs', '/showcase', '/sponsors'];

const EMPTY_SITEMAP = '<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>';

async function buildSitemap(): Promise<string> {
	// Unlike llms.txt (whose relative links still work with no configured
	// SITE_URL), the sitemap protocol requires absolute <loc> URLs — the
	// `sitemap` package throws rather than falling back to relative ones.
	// A fresh scaffold with SITE_URL unset can't produce a meaningful
	// sitemap yet, so ship an empty (but valid) one instead of failing the
	// build or emitting URLs pointing at nothing real.
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
