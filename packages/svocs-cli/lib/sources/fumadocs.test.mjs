import { describe, expect, it } from 'vitest';
import fumadocs, { convertMeta } from './fumadocs.mjs';

describe('convertMeta', () => {
	it('turns ---Title--- entries into separators, in order', () => {
		const notes = [];
		const { entries } = convertMeta(
			{ pages: ['---Getting started---', 'index', 'install', '---[Rocket]Guides---', 'writing'] },
			notes,
			''
		);
		expect(entries).toEqual([
			['', 'separator-1', { type: 'separator', title: 'Getting started', order: 1 }],
			['', 'index', { order: 2 }],
			['', 'install', { order: 3 }],
			['', 'separator-2', { type: 'separator', title: 'Guides', order: 4 }],
			['', 'writing', { order: 5 }]
		]);
		expect(notes).toEqual([]);
	});

	it('places nested paths and ...folder entries in their folders', () => {
		const notes = [];
		const { entries } = convertMeta(
			{ pages: ['concepts/decibels', 'concepts/theming', '...components', '...'] },
			notes,
			''
		);
		expect(entries).toEqual([
			['', 'concepts', { order: 1 }],
			['concepts', 'decibels', { order: 1 }],
			['concepts', 'theming', { order: 2 }],
			['', 'components', { order: 2 }]
		]);
		expect(notes).toHaveLength(2);
	});

	it('drops sidebar links with a note', () => {
		const notes = [];
		const { entries } = convertMeta({ pages: ['[GitHub](https://github.com)', 'a'] }, notes, 'x');
		expect(entries).toEqual([['x', 'a', { order: 1 }]]);
		expect(notes[0]).toContain('sidebar link');
	});
});

describe('convertPage', () => {
	const convert = (source, rel = 'index.mdx') => {
		const todos = [];
		const notes = [];
		const page = fumadocs.convertPage(source, {
			rel,
			links: rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '',
			todos,
			notes,
			state: fumadocs.prepare()
		});
		return { ...page, todos, notes };
	};

	it('keeps the section a getPageTreePeers() card list names', () => {
		const { content, notes } = convert(
			[
				"import { getPageTreePeers } from 'fumadocs-core/page-tree';",
				"import { source } from '@/lib/source';",
				'',
				'<Cards>',
				'  {getPageTreePeers(source.getPageTree(), "/docs/resources").filter((p) => p.name !== "X").map((peer) => (',
				'    <Card key={peer.url} title={peer.name} href={peer.url} />',
				'  ))}',
				'</Cards>'
			].join('\n')
		);
		expect(content).toContain('<Cards of="/docs/resources" />');
		expect(notes[0]).toContain('filtered');
	});

	it('turns a page include into a placeholder resolved after conversion', () => {
		const { content, todos } = convert('<include>./tebex.mdx</include>', 'resources/index.mdx');
		expect(content).toContain('<svocs-include src="resources/tebex.mdx" />');
		expect(todos).toEqual([]);
	});

	it('flags includes it cannot map', () => {
		const { content, todos } = convert('<include lang="ts">./code.ts</include>');
		expect(content).toContain('svocs migrate TODO');
		expect(todos).toHaveLength(1);
	});
});
