export const SITE_NAME = '__SITE_NAME__';
export const SITE_DESCRIPTION = 'Documentation built with SVOCS.';

/**
 * Your production domain, e.g. 'https://docs.example.com' — no trailing
 * slash. Used to build absolute URLs in llms.txt/llms-full.txt. Left empty
 * by default (falls back to relative paths, which still work) since a
 * fresh scaffold doesn't know its own domain yet.
 */
export const SITE_URL = '';

/**
 * Link to this project's repository. When set, the header shows a GitHub
 * button pointing here, and doc pages get an "Edit on GitHub" link. Leave
 * empty to hide both.
 */
export const REPO_URL = '';

/** Branch "Edit on GitHub" links point at. */
export const REPO_BRANCH = 'main';

/** GitHub blob URL for a content file's `content/…` path, or undefined without a REPO_URL. */
export function getEditUrl(sourcePath: string): string | undefined {
	return REPO_URL ? `${REPO_URL}/blob/${REPO_BRANCH}/${sourcePath}` : undefined;
}
