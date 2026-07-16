/**
 * Canonical production origin — hardcoded rather than derived from
 * page.url, since prerendering runs through an internal placeholder origin
 * that must never end up baked into og:url/canonical tags in the static
 * output.
 */
export const SITE_URL = 'https://svocs.dev';
export const SITE_NAME = 'SVOCS';
