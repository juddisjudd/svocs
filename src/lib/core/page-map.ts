import type { ContentSummary } from '$lib/core/content';

type MutableNode = {
	slug: string;
	path: string;
	title: string;
	order: number;
	isDocument: boolean;
	children: Map<string, MutableNode>;
};

export type PageMapNode = {
	slug: string;
	path: string;
	title: string;
	order: number;
	isDocument: boolean;
	children: PageMapNode[];
};

export type Breadcrumb = {
	title: string;
	path: string;
};

function titleFromSegment(segment: string): string {
	return segment
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function pathFromSlug(slug: string): string {
	return slug ? `/docs/${slug}` : '/docs';
}

function sortNodes(nodes: MutableNode[]): MutableNode[] {
	return nodes.sort((a, b) => {
		if (a.order !== b.order) {
			return a.order - b.order;
		}

		return a.title.localeCompare(b.title);
	});
}

function finalizeNode(node: MutableNode): PageMapNode {
	const children = sortNodes(Array.from(node.children.values())).map(finalizeNode);

	return {
		slug: node.slug,
		path: node.path,
		title: node.title,
		order: node.order,
		isDocument: node.isDocument,
		children
	};
}

export function buildDocsPageMap(entries: ContentSummary[]): PageMapNode[] {
	const roots = new Map<string, MutableNode>();

	for (const entry of entries) {
		const segments = entry.slug.split('/').filter(Boolean);

		let current: Map<string, MutableNode> = roots;
		let currentSlug = '';

		for (let i = 0; i < segments.length; i += 1) {
			const segment = segments[i];
			currentSlug = currentSlug ? `${currentSlug}/${segment}` : segment;

			let node = current.get(segment);
			if (!node) {
				node = {
					slug: currentSlug,
					path: pathFromSlug(currentSlug),
					title: titleFromSegment(segment),
					order: 999,
					isDocument: false,
					children: new Map<string, MutableNode>()
				};
				current.set(segment, node);
			}

			if (i === segments.length - 1) {
				node.title = entry.title;
				node.order = entry.order;
				node.isDocument = true;
			}

			current = node.children;
		}
	}

	return sortNodes(Array.from(roots.values())).map(finalizeNode);
}

function findNodeBySlug(slug: string, nodes: PageMapNode[]): PageMapNode | null {
	for (const node of nodes) {
		if (node.slug === slug) {
			return node;
		}

		const nested = findNodeBySlug(slug, node.children);
		if (nested) {
			return nested;
		}
	}

	return null;
}

export function getBreadcrumbsByPath(pathname: string, nodes: PageMapNode[]): Breadcrumb[] {
	if (!pathname.startsWith('/docs')) {
		return [];
	}

	const rawSlug = pathname.replace(/^\/docs\/?/, '');
	const segments = rawSlug.split('/').filter(Boolean);

	const breadcrumbs: Breadcrumb[] = [{ title: 'Docs', path: '/docs' }];

	let currentSlug = '';
	for (const segment of segments) {
		currentSlug = currentSlug ? `${currentSlug}/${segment}` : segment;
		const node = findNodeBySlug(currentSlug, nodes);

		breadcrumbs.push({
			title: node?.title ?? titleFromSegment(segment),
			path: pathFromSlug(currentSlug)
		});
	}

	return breadcrumbs;
}
