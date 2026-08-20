import type { PageLoad } from './$types';
import { loadDocComponent } from '$lib/core/content';

export const prerender = true;

export const load: PageLoad = async ({ data }) => {
	return { ...data, Content: await loadDocComponent(data.entry.slug) };
};
