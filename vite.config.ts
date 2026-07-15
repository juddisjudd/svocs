import { mdsvex } from 'mdsvex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { highlightWithFilename } from './src/lib/build/code-highlighter';

type MdsvexOptions = NonNullable<Parameters<typeof mdsvex>[0]>;
type MdsvexRehypePlugin = NonNullable<MdsvexOptions['rehypePlugins']>[number];

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
	] as unknown as MdsvexRehypePlugin
];

const mdsvexOptions = {
	extensions: ['.svx', '.md'],
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
			extensions: ['.svelte', '.svx', '.md']
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
