import { describe, expect, it } from 'vitest';
import {
	extractTocFromMarkdown,
	getAllLlmsDocuments,
	getAllSearchDocuments,
	getDocEntryBySlug,
	getDocsEntries,
	getDocTocBySlug,
	getRawMarkdownBySlug,
	stripMarkdownToText,
	stripSourceForExport
} from './content';

// These run against the real content/ tree, so they assert invariants every
// SVOCS site must satisfy rather than this site's specific pages.

describe('content registry', () => {
	it('memoizes the registry', () => {
		expect(getDocsEntries()).toBe(getDocsEntries());
	});

	it('derives routes from slugs', () => {
		for (const entry of getDocsEntries()) {
			expect(entry.path).toBe(entry.slug ? `/docs/${entry.slug}` : '/docs');
			expect(entry.sourcePath.startsWith('content/')).toBe(true);
			expect(entry.readingTimeMinutes).toBeGreaterThanOrEqual(1);
		}
	});

	it('sorts by order, then slug', () => {
		const entries = getDocsEntries();
		for (let i = 1; i < entries.length; i += 1) {
			const [a, b] = [entries[i - 1], entries[i]];
			expect(a.order < b.order || (a.order === b.order && a.slug <= b.slug)).toBe(true);
		}
	});

	it('looks up entries by slug parts', () => {
		const first = getDocsEntries()[0];
		expect(getDocEntryBySlug(first.slug.split('/'))).toBe(first);
		expect(getDocEntryBySlug(['does', 'not', 'exist'])).toBeNull();
		expect(getRawMarkdownBySlug(['does', 'not', 'exist'])).toBeNull();
		expect(getDocTocBySlug(['does', 'not', 'exist'])).toEqual([]);
	});

	it('gives search and llms documents one entry per doc', () => {
		const docs = getDocsEntries();
		expect(getAllSearchDocuments()).toHaveLength(docs.length);
		expect(getAllLlmsDocuments()).toHaveLength(docs.length);
		for (const doc of getAllLlmsDocuments()) {
			expect(doc.raw.startsWith('---')).toBe(false);
			expect(doc.raw).not.toMatch(/^<script/m);
		}
	});
});

describe('extractTocFromMarkdown', () => {
	it('collects h2/h3 outside code fences with github-style ids', () => {
		const raw = [
			'# Title',
			'## Getting Started',
			'```md',
			'## Not a heading',
			'```',
			'### With [a link](https://example.com)',
			'## Getting Started'
		].join('\n');
		expect(extractTocFromMarkdown(raw)).toEqual([
			{ id: 'getting-started', text: 'Getting Started', depth: 2 },
			{ id: 'with-a-link', text: 'With a link', depth: 3 },
			{ id: 'getting-started-1', text: 'Getting Started', depth: 2 }
		]);
	});
});

describe('stripSourceForExport', () => {
	it('removes frontmatter and the script block, keeps fences intact', () => {
		const raw = [
			'---',
			'title: X',
			'---',
			'<script>',
			"\timport Callout from '$lib/components/Callout.svelte';",
			'</script>',
			'',
			'Body',
			'',
			'```svelte',
			'<script>kept</script>',
			'```'
		].join('\n');
		expect(stripSourceForExport(raw)).toBe('Body\n\n```svelte\n<script>kept</script>\n```');
	});

	it('leaves plain markdown alone', () => {
		expect(stripSourceForExport('## Hi\n\ntext')).toBe('## Hi\n\ntext');
	});
});

describe('stripMarkdownToText', () => {
	it('drops code fences and markdown punctuation', () => {
		const text = stripMarkdownToText('## Hi\n\n`code` and **bold**\n\n```js\nconst x = 1;\n```\n');
		expect(text).toBe('Hi code and bold');
	});
});
