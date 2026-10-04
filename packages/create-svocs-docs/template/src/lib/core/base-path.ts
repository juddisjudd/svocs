import { resolve } from '$app/paths';

/**
 * Prefixes a root-relative URL from content or a search index (`/docs/x`)
 * with the deploy base path, so it still works when BASE_PATH is set.
 */
export function withBase(url: string): string {
	const root = resolve('/');
	if (!url.startsWith('/') || url.startsWith('//') || url.startsWith(root)) {
		return url;
	}
	return root + url.slice(1);
}
