// Source-framework adapters for `svocs migrate`. Each adapter implements:
//
//   id / label / homepage / blurb   identity + the respectful one-liner
//   detect(sourceDir)               does this directory use the framework?
//   contentDir(sourceDir)           docs root, or null (contentHint explains)
//   extensions                      page file extensions
//   skipFile?(name, rel)            extra per-file filter
//   outRel?(rel)                    output path mapping (prefix stripping etc.)
//   siteName?(sourceDir)            site name from framework config
//   prepare?(ctx)                   one-time state shared by the passes below
//   convertPage(source, ctx)        -> { ext, content }
//   collectMeta(ctx)                -> Map<dir, _meta items> (runs after pages)
//
// svocs isn't out to "win" anyone away from these tools — every one of them
// is good software. The converters exist so that people who want to try a
// Svelte-based docs site can do it in an afternoon instead of a weekend.
import docusaurus from './docusaurus.mjs';
import fumadocs from './fumadocs.mjs';
import mdbook from './mdbook.mjs';
import mkdocs from './mkdocs.mjs';
import nextra from './nextra.mjs';
import starlight from './starlight.mjs';

export const SOURCES = [fumadocs, nextra, docusaurus, starlight, mkdocs, mdbook];

export function detectSource(sourceDir) {
	return SOURCES.find((source) => source.detect(sourceDir)) ?? null;
}
