import { describe, expect, it } from 'vitest';
import { excerptAround, groupRecords, toSearchRecords } from './records';

const records = toSearchRecords({
	id: 'lib/player',
	url: '/docs/lib/player',
	title: 'Player',
	description: 'A player class.',
	content: 'Body text.',
	sections: [
		{ id: 'ped-methods', title: 'Ped Methods', content: 'Methods from Ped.' },
		{ id: 'getarmour', title: 'getArmour', content: 'Gets the armour.' }
	]
});

describe('toSearchRecords', () => {
	it('makes one record for the page and one per section, titles only on the page', () => {
		expect(records.map((record) => [record.url, record.title, record.heading])).toEqual([
			['/docs/lib/player', 'Player', ''],
			['/docs/lib/player#ped-methods', '', 'Ped Methods'],
			['/docs/lib/player#getarmour', '', 'getArmour']
		]);
		expect(records[0].content).toBe('A player class. Body text.');
	});
});

describe('groupRecords', () => {
	it('folds section hits under their page, in hit order', () => {
		const [page] = groupRecords([records[2], records[0]], 'armour');
		expect(page).toMatchObject({ id: 'lib/player', url: '/docs/lib/player', title: 'Player' });
		expect(page.sections).toEqual([
			{ url: '/docs/lib/player#getarmour', title: 'getArmour', excerpt: 'Gets the armour.' }
		]);
	});
});

describe('excerptAround', () => {
	it('centres on the first query term and marks cut ends', () => {
		const text = `${'lead '.repeat(40)}the needle is here${' tail'.repeat(40)}`;
		const excerpt = excerptAround(text, 'needle', 60);
		expect(excerpt).toContain('needle');
		expect(excerpt.startsWith('…')).toBe(true);
		expect(excerpt.endsWith('…')).toBe(true);
	});
});
