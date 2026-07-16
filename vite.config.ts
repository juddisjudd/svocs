import { mdsvex } from 'mdsvex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex-svelte';
import remarkMath from 'remark-math';
import remarkMermaid from 'remark-mermaidjs';
import { visit } from 'unist-util-visit';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { highlightWithFilename } from './src/lib/build/code-highlighter';
import type { Root, Paragraph } from 'mdast';
import type { Element } from 'hast';

// $env/static/public (used in src/lib/search/resolver.ts) requires this to
// be defined at build time — a real compile-time constant lets the bundler
// dead-code-eliminate every unreachable provider branch, including its
// dynamic import() target. That matters beyond tree-shaking: a provider
// with a broken transitive dependency (e.g. chromadb's optional
// @chroma-core/default-embed) would otherwise fail EVERY build, even for
// deployments that never select it, since a non-constant discriminant
// forces the bundler to still resolve every branch's module graph.
process.env.PUBLIC_SVOCS_SEARCH_PROVIDER ??= 'pagefind';

type MdsvexOptions = NonNullable<Parameters<typeof mdsvex>[0]>;
type MdsvexRehypePlugin = NonNullable<MdsvexOptions['rehypePlugins']>[number];
type MdsvexRemarkPlugin = NonNullable<MdsvexOptions['remarkPlugins']>[number];

// KaTeX renders math to static HTML/CSS at build time (unlike MathJax, which
// needs a client-side runtime) — the same "no JS shipped for content
// rendering" approach remark-mermaidjs (below) uses for diagrams. remarkMath
// only parses $inline$/$$block$$ syntax into mdast math nodes; rehypeKatex
// does the actual rendering once those nodes reach the hast/rehype stage.
//
// Two version-specific gotchas, both required for this to work under
// mdsvex specifically (not just "with markdown" generally):
// - remark-math must stay on 3.x. mdsvex parses markdown with its own
//   customized parser rather than plain remark-parse, and later remark-math
//   versions rely on registering a micromark syntax extension that parser
//   doesn't pick up — $...$ / $$...$$ silently pass through as literal text
//   with anything newer.
// - rehype-katex-svelte, not the plain rehype-katex most other setups use.
//   KaTeX's rendered HTML contains literal `{`/`}` (from things like
//   `\frac{w}{200}` surfacing in class names or inline styles), and mdsvex
//   compiles rehype output straight into Svelte template markup — bare
//   `{...}` there is a Svelte expression, so plain rehype-katex breaks the
//   build with "w is not defined"-style errors. rehype-katex-svelte wraps
//   KaTeX's output in an escaped {@html "..."} block instead.
//
// remark-mermaidjs renders ```mermaid fences to static SVG at build time via
// a headless Playwright browser (reuses this project's existing Playwright
// install — no separate puppeteer copy). It has to be a *remark* plugin, not
// the more commonly recommended rehype-mermaid: mdsvex applies its own code
// fence highlighter (highlightWithFilename below) to every fenced block
// during its remark-stage pass, before any rehype plugin ever runs, which
// consumes/rewrites the ```mermaid block first and leaves rehype-mermaid
// nothing to match (see https://github.com/pngwn/MDsveX/issues/737).
// remark-mermaidjs runs earlier in the same remark pass mdsvex's own
// highlighter uses, so it transforms the code node before that collision
// happens. No dark/light theming — it renders once at build time to a
// static SVG, so it can't react to the runtime theme toggle; left at
// Mermaid's default theme rather than hardcoding one that'd look wrong in
// the other mode.
// remark-mermaidjs replaces the ```mermaid code node with a *paragraph*
// mdast node carrying the rendered SVG via `data.hChildren` — the paragraph
// type is just a carrier, mdast-to-hast still renders it as a literal <p>
// regardless of what hChildren override it holds. Mermaid's SVG output uses
// <foreignObject><div> for text labels, and a <div> can't legally nest
// inside a <p> — browsers silently "repair" that at runtime, but Svelte 5's
// compiler validates HTML nesting and fails the build over it
// (`node_invalid_placement`). Retargeting the render to a <div> via
// `data.hName` (an mdast-to-hast override respected regardless of the
// node's own type) sidesteps the invalid nesting without needing to patch
// remark-mermaidjs itself.
function remarkMermaidBlockFix() {
	return (tree: Root) => {
		visit(tree, 'paragraph', (node: Paragraph) => {
			const svg = (node.data as { hChildren?: Element[] } | undefined)?.hChildren?.[0];
			if (svg?.type === 'element' && svg.tagName === 'svg') {
				node.data = { ...node.data, hName: 'div' };
			}
		});
	};
}

const remarkPlugins: NonNullable<MdsvexOptions['remarkPlugins']> = [
	remarkMath as unknown as MdsvexRemarkPlugin,
	remarkMermaid as unknown as MdsvexRemarkPlugin,
	remarkMermaidBlockFix as unknown as MdsvexRemarkPlugin
];

const rehypePlugins: NonNullable<MdsvexOptions['rehypePlugins']> = [
	rehypeSlug as unknown as MdsvexRehypePlugin,
	[
		rehypeAutolinkHeadings,
		{
			behavior: 'append',
			properties: {
				className: ['heading-anchor'],
				'aria-label': 'Section link'
			}
		}
	] as unknown as MdsvexRehypePlugin,
	rehypeKatex as unknown as MdsvexRehypePlugin
];

const mdsvexOptions = {
	extensions: ['.svx', '.md'],
	remarkPlugins,
	rehypePlugins,
	highlight: { highlighter: highlightWithFilename, optimise: true }
} satisfies MdsvexOptions;

// These static-index routes deliberately 404 during prerendering whenever
// their backend isn't the active PUBLIC_SVOCS_SEARCH_PROVIDER (see
// src/routes/search-index.*.json/+server.ts) — every deployment builds all
// of them, but only one is ever non-404. SvelteKit's default prerender
// behavior fails the whole build on any prerendered 4xx, so this allowlists
// exactly those two expected-inert routes while still failing hard on any
// other unexpected prerender error.
const INERT_SEARCH_INDEX_ROUTES = new Set([
	'/search-index.orama.json',
	'/search-index.flexsearch.json'
]);

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// fallback: a static host that doesn't know our routes (nginx,
			// Coolify, etc.) serves this for any unmatched path so the
			// client-side router can render our real +error.svelte instead
			// of the host's own generic 404.
			adapter: adapter({ fallback: '404.html' }),
			// Set BASE_PATH when deploying under a sub-path, e.g. GitHub Pages
			// project sites: BASE_PATH=/my-repo
			paths: {
				base: process.env.BASE_PATH?.startsWith('/') ? (process.env.BASE_PATH as `/${string}`) : ''
			},
			preprocess: [mdsvex(mdsvexOptions)],
			extensions: ['.svelte', '.svx', '.md'],
			prerender: {
				handleHttpError: ({ path, message }) => {
					if (INERT_SEARCH_INDEX_ROUTES.has(path)) {
						return;
					}
					throw new Error(message);
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
