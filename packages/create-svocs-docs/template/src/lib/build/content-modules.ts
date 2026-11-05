import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';

const CONTENT_PAGE = /\/content\/.+\.(md|svx)$/;

// SvelteKit refuses to bundle any `server.*` file or `server/` folder for the browser; loading doc pages first keeps `content/api/server.md` a page.
export function contentModules(): Plugin {
	let contentRoot = '';
	return {
		name: 'svocs-content-modules',
		enforce: 'pre',
		configResolved(config) {
			contentRoot = `${config.root.replace(/\\/g, '/')}/content/`;
		},
		load(id) {
			if (!id.startsWith(contentRoot) || !CONTENT_PAGE.test(id)) {
				return undefined;
			}
			return readFile(id, 'utf8');
		}
	};
}
