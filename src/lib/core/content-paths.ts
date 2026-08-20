export const CONTENT_PREFIX = '/content/';
export const EXTENSION_RE = /\.(md|svx)$/;

/** `/content/guides/index.md` → `guides`; `/content/index.md` → ``. */
export function toSlug(filePath: string): string {
	const relativePath = filePath.slice(CONTENT_PREFIX.length).replace(EXTENSION_RE, '');
	return relativePath === 'index' ? '' : relativePath.replace(/\/index$/, '');
}

export function routeFromSlug(slug: string): string {
	return slug ? `/docs/${slug}` : '/docs';
}

/** `_meta.md` / `_meta.svx` are reserved and never become pages. */
export function isReservedSource(filePath: string): boolean {
	return /\/_meta\.(md|svx)$/.test(filePath);
}
