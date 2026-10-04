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
 * The page's pathname without the deploy base path (`/my-repo/docs/x` →
 * `/docs/x`), so it compares against page-map paths when BASE_PATH is set.
 * Takes the URL, not the pathname: SvelteKit renders relative paths, so
 * resolve('/') is `../`-style during prerendering and only becomes the
 * absolute base once resolved against the page URL.
 */
export function withoutBase(url: { readonly href: string; readonly pathname: string }): string {
	const root = new URL(resolve('/'), url.href).pathname;
	if (`${url.pathname}/` === root) {
		return '/';
	}
	return url.pathname.startsWith(root) ? `/${url.pathname.slice(root.length)}` : url.pathname;
}
