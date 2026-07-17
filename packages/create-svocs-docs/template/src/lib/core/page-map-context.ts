// Shared Svelte context key so content components (e.g. `<Cards auto>`) can
// read the doc site's page tree without prop-drilling it through every
// route and mdsvex-rendered page.
export const DOCS_PAGE_MAP_CONTEXT = Symbol('docs-page-map');
