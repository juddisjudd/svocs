import { describe, expect, it } from 'vitest';
import type { ContentSummary } from './content';
import {
	buildDocsPageMap,
	getBreadcrumbsByPath,
	getPageTreeSiblings,
	type DirectoryMeta
} from './page-map';

function entry(slug: string, order = 999, extra: Partial<ContentSummary> = {}): ContentSummary {
	const title = slug.split('/').pop() || 'Home';
	return {
		slug,
		path: slug ? `/docs/${slug}` : '/docs',
		title,
		order,
		tags: [],
		wordCount: 10,
		readingTimeMinutes: 1,
		sourcePath: `content/${slug || 'index'}.md`,
		...extra
	};
}

const entries = [
	entry('intro', 1),
	entry('guides/writing', 2),
	entry('guides/components', 1),
	entry('deploy', 3),
	entry('deploy/pages', 1)
];

const meta: DirectoryMeta = new Map([
	[
		'',
		{
			'start-heading': { type: 'separator', title: 'Start', order: 0 },
			guides: { title: 'All Guides', order: 2, icon: 'book' }
		}
	]
]);

describe('buildDocsPageMap', () => {
	it('nests pages under folders and sorts by order', () => {
		const map = buildDocsPageMap(entries, meta);
		expect(map.map((n) => (n.kind === 'page' ? n.slug : `sep:${n.title}`))).toEqual([
			'sep:Start',
			'intro',
			'guides',
			'deploy'
		]);
		const guides = map.find((n) => n.kind === 'page' && n.slug === 'guides');
		if (guides?.kind !== 'page') throw new Error('guides folder missing');
		expect(guides.isDocument).toBe(false);
		expect(guides.title).toBe('All Guides');
		expect(guides.icon).toBe('book');
		expect(guides.children.map((c) => (c.kind === 'page' ? c.slug : ''))).toEqual([
			'guides/components',
			'guides/writing'
		]);
	});

	it('lets a folder index page keep its own title', () => {
		const map = buildDocsPageMap(entries, meta);
		const deploy = map.find((n) => n.kind === 'page' && n.slug === 'deploy');
		if (deploy?.kind !== 'page') throw new Error('deploy missing');
		expect(deploy.isDocument).toBe(true);
		expect(deploy.title).toBe('deploy');
		expect(deploy.children).toHaveLength(1);
	});
});

describe('getPageTreeSiblings', () => {
	const map = buildDocsPageMap(entries, meta);

	it('returns children for a section index', () => {
		expect(getPageTreeSiblings(map, '/docs/deploy').map((n) => n.slug)).toEqual(['deploy/pages']);
	});

	it('returns siblings for a leaf, excluding itself and separators', () => {
		expect(getPageTreeSiblings(map, '/docs/intro').map((n) => n.slug)).toEqual(['deploy']);
	});
});

describe('getBreadcrumbsByPath', () => {
	it('walks the slug, using node titles when known', () => {
		const map = buildDocsPageMap(entries, meta);
		expect(getBreadcrumbsByPath('/docs/guides/writing', map)).toEqual([
			{ title: 'Docs', path: '/docs' },
			{ title: 'All Guides', path: '/docs/guides' },
			{ title: 'writing', path: '/docs/guides/writing' }
		]);
		expect(getBreadcrumbsByPath('/showcase', map)).toEqual([]);
	});
});
