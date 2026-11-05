import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

vi.mock('#lib/site.js', () => ({ SITE_URL: 'https://user.github.io/repo' }));
vi.mock('#lib/server/content.js', () => ({
	getDocsEntries: () => [{ path: '/docs/getting-started', lastModified: '2026-01-01' }]
}));

describe('sitemap.xml', () => {
	it('keeps the sub-path from SITE_URL in every URL', async () => {
		const xml = await (await GET({} as never)).text();
		const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, loc]) => loc);
		expect(locs).toContain('https://user.github.io/repo/');
		expect(locs).toContain('https://user.github.io/repo/docs/getting-started');
		expect(locs.every((loc) => loc.startsWith('https://user.github.io/repo/'))).toBe(true);
	});
});
