import type { LayoutLoad } from './$types';
import { getDocsEntries } from '$lib/core/content';
import { buildDocsPageMap } from '$lib/core/page-map';

export const prerender = true;

export const load: LayoutLoad = async () => {
	const docs = getDocsEntries();

	return {
		docs,
		pageMap: buildDocsPageMap(docs)
	};
};
