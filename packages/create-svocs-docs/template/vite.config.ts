import { mdsvex } from 'mdsvex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex-svelte';
import remarkMath from 'remark-math';
import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { highlightWithFilename } from './src/lib/build/code-highlighter';

// $env/static/public (used in src/lib/search/resolver.ts) requires this to
// be defined at build time — override it to pick a different search
// backend, see https://svocs.dev/docs/search
process.env.PUBLIC_SVOCS_SEARCH_PROVIDER ??= 'pagefind';

type MdsvexOptions = NonNullable<Parameters<typeof mdsvex>[0]>;
type MdsvexRehypePlugin = NonNullable<MdsvexOptions['rehypePlugins']>[number];
type MdsvexRemarkPlugin = NonNullable<MdsvexOptions['remarkPlugins']>[number];

// KaTeX renders math to static HTML/CSS at build time (unlike MathJax, which
// needs a client-side runtime). remarkMath
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
// Mermaid fences are NOT rendered at build time — that would require a
// headless browser (every build-time mermaid tool drives one for layout
// measurement), and shipping Chromium as a build dependency is exactly what
// this pipeline avoids. Instead highlightWithFilename passes ```mermaid
// fences through as `<pre class="mermaid">` carrying the raw source, and the
// docs layout lazy-imports mermaid in the reader's browser only on pages
// that actually contain one (src/lib/themes/docs/mermaid.ts).
const remarkPlugins: NonNullable<MdsvexOptions['remarkPlugins']> = [
	remarkMath as unknown as MdsvexRemarkPlugin
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

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Set BASE_PATH when deploying under a sub-path, e.g. GitHub Pages
			// project sites: BASE_PATH=/my-repo
			paths: {
				base: process.env.BASE_PATH?.startsWith('/') ? (process.env.BASE_PATH as `/${string}`) : ''
			},
			preprocess: [mdsvex(mdsvexOptions)],
			extensions: ['.svelte', '.svx', '.md']
		})
	]
});
