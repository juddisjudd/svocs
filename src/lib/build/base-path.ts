import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

/**
 * Rehype plugin: prefixes root-relative links and image sources in rendered
 * markdown with the deploy base path, so `[x](/docs/y)` works under BASE_PATH.
 */
export function rehypeBasePath(base: string) {
	return () => (tree: Root) => {
		if (!base) {
			return;
		}
		visit(tree, 'element', (node: Element) => {
			for (const name of ['href', 'src']) {
				const value = node.properties?.[name];
				if (
					typeof value === 'string' &&
					value.startsWith('/') &&
					!value.startsWith('//') &&
					value !== base &&
					!value.startsWith(`${base}/`)
				) {
					node.properties[name] = base + value;
				}
			}
		});
	};
}
