import { mdsvex } from 'mdsvex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex-svelte';
import remarkMath from 'remark-math';
import { execFileSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { highlightWithFilename } from './src/lib/build/code-highlighter';

// "Last updated" dates come from git history, not file mtimes — mtimes reset
// to "now" on every fresh clone and Docker build. One `git log` walk maps
// each content file to its most recent commit date; without git history
// (new scaffolds, tarball checkouts) the map stays empty and pages simply
// don't show a date.
function contentDatesPlugin(): Plugin {
	const virtualId = 'virtual:svocs-content-dates';
	const resolvedId = `\0${virtualId}`;
	return {
		name: 'svocs-content-dates',
		resolveId(id) {
			return id === virtualId ? resolvedId : undefined;
		},
		load(id) {
			if (id !== resolvedId) {
				return undefined;
			}
			const dates: Record<string, string> = {};
			try {
				const log = execFileSync(
					'git',
					['log', '--format=%x00%cI', '--name-only', '--relative', '--', 'content'],
					{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
				);
				let commitDate = '';
				for (const line of log.split('\n')) {
					if (line.startsWith('\0')) {
						commitDate = line.slice(1, 11); // YYYY-MM-DD
					} else if (line.startsWith('content/') && commitDate && !(line in dates)) {
						// log is newest-first, so the first sighting wins
						dates[line] = commitDate;
					}
				}
			} catch {
				// not a git repo, or git unavailable
			}
			return `export default ${JSON.stringify(dates)};`;
		}
	};
}

// $env/static/public (used in src/lib/search/resolver.ts) requires this to
// be defined at build time — override it to pick a different search
// backend, see https://svocs.dev/docs/search
process.env.PUBLIC_SVOCS_SEARCH_PROVIDER ??= 'pagefind';

type MdsvexOptions = NonNullable<Parameters<typeof mdsvex>[0]>;
type MdsvexRehypePlugin = NonNullable<MdsvexOptions['rehypePlugins']>[number];
type MdsvexRemarkPlugin = NonNullable<MdsvexOptions['remarkPlugins']>[number];

// remark-math must stay on 3.x: newer versions register a micromark
// extension mdsvex's parser doesn't pick up, so $math$ passes through as
// literal text. rehype-katex-svelte (not plain rehype-katex) because KaTeX
// output contains bare `{}` that mdsvex would compile as Svelte expressions.
// Mermaid fences are rendered client-side (src/lib/themes/docs/mermaid.ts);
// build-time rendering would require shipping a headless browser.
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
		contentDatesPlugin(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// fallback renders build/404.html, which GitHub Pages and
			// Cloudflare serve for unknown routes
			adapter: adapter({ fallback: '404.html' }),
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
