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

/**
 * Strips the deploy base path from a pathname (`/my-repo/docs/x` →
 * `/docs/x`), so it compares against page-map paths when BASE_PATH is set.
 */
export function withoutBase(pathname: string): string {
	const base = resolve('/').slice(0, -1);
	if (!base || (pathname !== base && !pathname.startsWith(`${base}/`))) {
		return pathname;
	}
	return pathname.slice(base.length) || '/';
}
