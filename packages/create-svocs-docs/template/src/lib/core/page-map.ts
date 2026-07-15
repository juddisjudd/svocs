import type { ContentSummary, MetaItemConfig } from '$lib/core/content';

/** Directory path ('' for the content root) → that directory's `_meta.json` `items` map. */
export type DirectoryMeta = Map<string, Record<string, MetaItemConfig>>;

type MutablePageNode = {
	slug: string;
	path: string;
	title: string;
	order: number;
	isDocument: boolean;
	children: Map<string, MutablePageNode>;
};

export type PageMapNode =
	| {
			kind: 'page';
			slug: string;
			path: string;
			title: string;
			order: number;
			isDocument: boolean;
			children: PageMapNode[];
	  }
	| {
			/** A non-clickable heading, declared via `{ "type": "separator" }`
			 *  in `_meta.json`, that visually groups the sibling items around
			 *  it — it has no route and no children of its own. */
			kind: 'separator';
			title: string;
			order: number;
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

function finalizeNode(node: MutablePageNode, dirMeta: DirectoryMeta): PageMapNode {
	return {
		kind: 'page',
		slug: node.slug,
		path: node.path,
		title: node.title,
		order: node.order,
		isDocument: node.isDocument,
		children: buildLevel(Array.from(node.children.values()), node.slug, dirMeta)
	};
}

/**
 * Finalizes one directory's worth of page nodes and interleaves them with
 * any `type: 'separator'` entries that directory's `_meta.json` declares,
 * sorting the combined list by `order` (ties broken alphabetically by
 * title) so labels land in the right spot among the pages they group.
 */
function buildLevel(
	pageNodes: MutablePageNode[],
	directory: string,
	dirMeta: DirectoryMeta
): PageMapNode[] {
	const finalizedPages = pageNodes.map((node) => finalizeNode(node, dirMeta));

	const separators: PageMapNode[] = [];
	const items = dirMeta.get(directory);
	if (items) {
		for (const config of Object.values(items)) {
			if (config.type === 'separator' && config.title && config.order !== undefined) {
				separators.push({ kind: 'separator', title: config.title, order: config.order });
			}
		}
	}

	return [...finalizedPages, ...separators].sort((a, b) => {
		if (a.order !== b.order) {
			return a.order - b.order;
		}

		return a.title.localeCompare(b.title);
	});
}

export function buildDocsPageMap(
	entries: ContentSummary[],
	dirMeta: DirectoryMeta = new Map()
): PageMapNode[] {
	const roots = new Map<string, MutablePageNode>();

	for (const entry of entries) {
		const segments = entry.slug.split('/').filter(Boolean);

		let current: Map<string, MutablePageNode> = roots;
		let currentSlug = '';
		let parentDirectory = '';

		for (let i = 0; i < segments.length; i += 1) {
			const segment = segments[i];
			currentSlug = currentSlug ? `${currentSlug}/${segment}` : segment;

			let node = current.get(segment);
			if (!node) {
				// Auto-created intermediate folder node — pick up a custom
				// title/order from the parent directory's _meta.json if one
				// is declared for this segment, same as a real document would.
				const override = dirMeta.get(parentDirectory)?.[segment];
				node = {
					slug: currentSlug,
					path: pathFromSlug(currentSlug),
					title: override?.title ?? titleFromSegment(segment),
					order: override?.order ?? 999,
					isDocument: false,
					children: new Map<string, MutablePageNode>()
				};
				current.set(segment, node);
			}

			if (i === segments.length - 1) {
				node.title = entry.title;
				node.order = entry.order;
				node.isDocument = true;
			}

			parentDirectory = currentSlug;
			current = node.children;
		}
	}

	return buildLevel(Array.from(roots.values()), '', dirMeta);
}

function findNodeBySlug(slug: string, nodes: PageMapNode[]): PageMapNode | null {
	for (const node of nodes) {
		if (node.kind !== 'page') {
			continue;
		}

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
			title: node?.kind === 'page' ? node.title : titleFromSegment(segment),
			path: pathFromSlug(currentSlug)
		});
	}

	return breadcrumbs;
}
