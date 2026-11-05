import GithubSlugger from 'github-slugger';
import type { Element, ElementContent, Root } from 'hast';
import { visit } from 'unist-util-visit';

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text: string): string {
	return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
		if (code[0] !== '#') {
			return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
		}
		const point =
			code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
		return String.fromCodePoint(point);
	});
}

function textOf(node: ElementContent): string {
	if (node.type === 'text') {
		return node.value;
	}
	return 'children' in node ? node.children.map(textOf).join('') : '';
}

// mdsvex stores `<`, `{` and friends in heading text as entities, so they are decoded before slugging to match the TOC's ids.
export function rehypeHeadingIds() {
	return () => (tree: Root) => {
		const slugger = new GithubSlugger();
		visit(tree, 'element', (node: Element) => {
			if (/^h[1-6]$/.test(node.tagName) && !node.properties.id) {
				node.properties.id = slugger.slug(decodeEntities(node.children.map(textOf).join('')));
			}
		});
	};
}
