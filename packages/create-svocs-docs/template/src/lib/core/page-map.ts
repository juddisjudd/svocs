import type { ContentSummary, MetaItemConfig } from '$lib/core/content';

/** Directory path ('' for the content root) → that directory's `_meta.json` `items` map. */
export type DirectoryMeta = Map<string, Record<string, MetaItemConfig>>;

type MutablePageNode = {
	slug: string;
	path: string;
	title: string;
	description?: string;
	order: number;
	isDocument: boolean;
	icon?: string;
	children: Map<string, MutablePageNode>;
};

export type PageMapNode =
	| {
			kind: 'page';
			slug: string;
			path: string;
			title: string;
			description?: string;
			order: number;
			isDocument: boolean;
			icon?: string;
			children: PageMapNode[];
	  }
	| {
			/** Non-clickable sidebar heading from `_meta.json`; no route, no children. */
			kind: 'separator';
			title: string;
			order: number;
			icon?: string;
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
		description: node.description,
		order: node.order,
		isDocument: node.isDocument,
		icon: node.icon,
		children: buildLevel(Array.from(node.children.values()), node.slug, dirMeta)
	};
}

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
				separators.push({
					kind: 'separator',
					title: config.title,
					order: config.order,
					icon: config.icon
				});
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
				const override = dirMeta.get(parentDirectory)?.[segment];
				node = {
					slug: currentSlug,
					path: pathFromSlug(currentSlug),
					title: override?.title ?? titleFromSegment(segment),
					order: override?.order ?? 999,
					isDocument: false,
					icon: override?.icon,
					children: new Map<string, MutablePageNode>()
				};
				current.set(segment, node);
			}

			if (i === segments.length - 1) {
				node.title = entry.title;
				node.order = entry.order;
				node.description = entry.description;
				node.isDocument = true;
				// A folder's _meta.json icon (set above, when this node was first
				// created) wins over its own index page's frontmatter icon.
				node.icon = node.icon ?? entry.icon;
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

/**
 * Sibling document pages of the page at `path` — same parent, excluding
 * itself and separators. Backs `<Cards auto>`. Folders with no index page of
 * their own aren't linkable, so they're excluded rather than resolved.
 */
export function getPageTreeSiblings(
	nodes: PageMapNode[],
	path: string
): Extract<PageMapNode, { kind: 'page' }>[] {
	function siblingsWithin(list: PageMapNode[]): PageMapNode[] | null {
		if (list.some((node) => node.kind === 'page' && node.path === path)) {
			return list;
		}
		for (const node of list) {
			if (node.kind !== 'page') {
				continue;
			}
			const found = siblingsWithin(node.children);
			if (found) {
				return found;
			}
		}
		return null;
	}

	const siblings = siblingsWithin(nodes) ?? [];
	return siblings.filter(
		(node): node is Extract<PageMapNode, { kind: 'page' }> =>
			node.kind === 'page' && node.path !== path && node.isDocument
	);
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
