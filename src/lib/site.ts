/**
 * Canonical production origin — hardcoded rather than derived from
 * page.url, since prerendering runs through an internal placeholder origin
 * that must never end up baked into og:url/canonical tags in the static
 * output.
 */
export const SITE_URL = 'https://svocs.dev';
export const SITE_NAME = 'SVOCS';
export const REPO_URL = 'https://github.com/juddisjudd/svocs';
export const REPO_BRANCH = 'main';

/** GitHub blob URL for a content file's `content/…` path, or undefined without a REPO_URL. */
export function getEditUrl(sourcePath: string): string | undefined {
	return REPO_URL ? `${REPO_URL}/blob/${REPO_BRANCH}/${sourcePath}` : undefined;
}
