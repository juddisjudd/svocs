import { mdsvex } from 'mdsvex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex-svelte';
import remarkMath from 'remark-math';
import { execFileSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
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

// Must be a build-time constant so the bundler drops unselected provider
// branches — otherwise a broken dep in an unused provider fails every build.
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

// These routes 404 by design when their backend isn't the active provider;
// allowlist them so prerender still fails hard on any other 4xx.
const INERT_SEARCH_INDEX_ROUTES = new Set([
	'/search-index.orama.json',
	'/search-index.flexsearch.json'
]);

export default defineConfig({
	plugins: [
		contentDatesPlugin(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Static hosts serve this for unmatched paths so the client-side
			// router can render +error.svelte instead of the host's 404.
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
