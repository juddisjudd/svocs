import type { LayoutServerLoad } from './$types';
import { getDocsEntries, loadMetaByDirectory } from '$lib/server/content';
import { buildDocsPageMap } from '$lib/core/page-map';

export const prerender = true;

export const load: LayoutServerLoad = async () => {
	return {
		pageMap: buildDocsPageMap(getDocsEntries(), loadMetaByDirectory())
	};
};
