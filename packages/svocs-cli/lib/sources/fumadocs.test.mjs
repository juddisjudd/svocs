import { describe, expect, it } from 'vitest';
import { convertMeta } from './fumadocs.mjs';

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
