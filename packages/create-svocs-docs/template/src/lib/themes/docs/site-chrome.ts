import { getContext, setContext, type Snippet } from 'svelte';

/** Header and footer pieces from the root layout, placed by the docs layout around its full-height sidebar. */
export type SiteChrome = {
	brand: Snippet;
	links?: Snippet;
	actions: Snippet;
	footer?: Snippet;
};

const SITE_CHROME = Symbol('svocs-site-chrome');

export function setSiteChrome(chrome: SiteChrome): void {
	setContext(SITE_CHROME, chrome);
}

// Undefined under a root layout that still draws its own header above the docs.
export function getSiteChrome(): SiteChrome | undefined {
	return getContext<SiteChrome | undefined>(SITE_CHROME);
}
