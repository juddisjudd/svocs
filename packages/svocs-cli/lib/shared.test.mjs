import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { findLegacyLibImports, isNewerVersion, kitMajor } from './shared.mjs';

describe('isNewerVersion', () => {
	it('compares numerically per segment', () => {
		expect(isNewerVersion('0.21.4', '0.21.3')).toBe(true);
		expect(isNewerVersion('0.21.10', '0.21.9')).toBe(true);
		expect(isNewerVersion('1.0.0', '0.99.99')).toBe(true);
		expect(isNewerVersion('0.21.3', '0.21.3')).toBe(false);
		expect(isNewerVersion('0.20.0', '0.21.0')).toBe(false);
	});

	it('treats missing segments as zero', () => {
		expect(isNewerVersion('1.0', '1.0.0')).toBe(false);
		expect(isNewerVersion('1.0.1', '1.0')).toBe(true);
	});
});

describe('SvelteKit 3 site checks', () => {
	const site = mkdtempSync(join(tmpdir(), 'svocs-site-'));
	afterAll(() => rmSync(site, { recursive: true, force: true }));

	it('reads the @sveltejs/kit major from package.json', () => {
		writeFileSync(
			join(site, 'package.json'),
			JSON.stringify({ devDependencies: { '@sveltejs/kit': '^3.0.0' } })
		);
		expect(kitMajor(site)).toBe(3);
		expect(kitMajor(join(site, 'missing'))).toBe(0);
	});

	it('lists src and content files that still import through $lib', () => {
		mkdirSync(join(site, 'src/routes'), { recursive: true });
		mkdirSync(join(site, 'content/guides'), { recursive: true });
		writeFileSync(join(site, 'src/routes/+page.svelte'), "import x from '#lib/x.js';");
		writeFileSync(
			join(site, 'content/guides/tabs.svx'),
			"<script>\n\timport Tabs from '$lib/components/Tabs.svelte';\n</script>"
		);
		writeFileSync(join(site, 'content/prose.md'), 'Mentions $lib in prose only.');
		expect(findLegacyLibImports(site)).toEqual(['content/guides/tabs.svx']);
	});
});
