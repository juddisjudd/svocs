import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import obsidian from './obsidian.mjs';

let vault;
let target;
let state;
const notes = [];

beforeAll(async () => {
	vault = mkdtempSync(join(tmpdir(), 'svocs-vault-'));
	target = mkdtempSync(join(tmpdir(), 'svocs-target-'));
	mkdirSync(join(vault, '.obsidian'));
	writeFileSync(join(vault, '.obsidian', 'app.json'), '{"attachmentFolderPath":"Files"}');
	mkdirSync(join(vault, 'Guides'));
	mkdirSync(join(vault, 'Files'));
	mkdirSync(join(vault, 'Templates'));
	writeFileSync(join(vault, '.obsidian', 'templates.json'), '{"folder":"Templates"}');
	writeFileSync(join(vault, 'Templates', 'Daily.md'), '# {{date}}');
	writeFileSync(join(vault, 'Files', 'diagram.png'), 'png');
	writeFileSync(join(vault, 'Getting Started.md'), '# Getting Started\n\nHello');
	writeFileSync(
		join(vault, 'Guides', 'Writing Notes.md'),
		[
			'---',
			'title: Writing',
			'tags: [a]',
			'---',
			'See [[Getting Started|start here]] and [[Getting Started#Setup]].',
			'',
			'> [!warning] Careful',
			"> Don't ==skip== this. %% private %%",
			'',
			'![[diagram.png|200]]',
			'',
			'```dataview',
			'LIST FROM #a',
			'```',
			'',
			'Also [[Missing Note]].'
		].join('\n')
	);
	writeFileSync(join(vault, 'Secret.md'), '---\npublish: false\n---\nhidden');
	state = await obsidian.prepare({ sourceDir: vault, contentDir: vault, targetDir: target, notes });
});

afterAll(() => {
	rmSync(vault, { recursive: true, force: true });
	rmSync(target, { recursive: true, force: true });
});

describe('obsidian adapter', () => {
	it('detects a vault by its .obsidian folder', () => {
		expect(obsidian.detect(vault)).toBe(true);
		expect(obsidian.detect(target)).toBe(false);
	});

	it('copies attachments into static/attachments', () => {
		expect(existsSync(join(target, 'static', 'attachments', 'diagram.png'))).toBe(true);
		expect(notes).toContain('copied 1 attachment(s) into static/attachments/');
	});

	it('slugifies output paths', () => {
		expect(obsidian.outRel('Guides/Writing Notes.md')).toBe('guides/writing-notes.md');
	});

	it('converts wikilinks, callouts, embeds, and flags vault-only blocks', () => {
		const todos = [];
		const page = obsidian.convertPage(
			readFileSync(join(vault, 'Guides', 'Writing Notes.md'), 'utf8'),
			{
				rel: 'Guides/Writing Notes.md',
				outRel: 'guides/writing-notes.md',
				baseDir: 'guides',
				todos,
				notes,
				state
			}
		);
		expect(page.ext).toBe('.svx');
		expect(page.content).toContain("import Callout from '$lib/components/Callout.svelte';");
		expect(page.content).toContain('title: Writing');
		expect(page.content).toContain(
			'See [start here](/docs/getting-started) and [Getting Started](/docs/getting-started#setup).'
		);
		expect(page.content).toContain(
			'<Callout type="warning">\n\n**Careful**\n\nDon\'t <mark>skip</mark> this. \n\n</Callout>'
		);
		expect(page.content).toContain(
			'<img src="/attachments/diagram.png" alt="diagram" width="200" />'
		);
		expect(page.content).toContain('<!-- svocs migrate TODO: dataview block');
		expect(page.content).toContain(
			'Missing Note<!-- svocs migrate TODO: unresolved wikilink [[Missing Note]] -->'
		);
		expect(todos).toEqual(['dataview block', 'wikilink target not found: Missing Note']);
	});

	it('skips unpublished notes and the templates folder', () => {
		const ctx = { rel: 'Secret.md', outRel: 'secret.md', baseDir: '', todos: [], notes, state };
		expect(obsidian.convertPage('---\npublish: false\n---\nhidden', ctx)).toBeNull();
		expect(obsidian.convertPage('# x', { ...ctx, rel: 'Templates/Daily.md' })).toBeNull();
	});

	it('titles untitled notes from the file name', () => {
		const page = obsidian.convertPage('# Getting Started\n\nHello', {
			rel: 'Getting Started.md',
			outRel: 'getting-started.md',
			baseDir: '',
			todos: [],
			notes,
			state
		});
		expect(page.ext).toBe('.md');
		expect(page.content.startsWith('---\ntitle: Getting Started\n---')).toBe(true);
	});
});
