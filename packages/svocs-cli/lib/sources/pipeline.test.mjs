import { describe, expect, it } from 'vitest';
import {
	annotateFences,
	assemblePage,
	hoistLeadingH1,
	rewriteLinks,
	splitFrontmatter,
	stripImports,
	toText
} from './pipeline.mjs';

describe('annotateFences', () => {
	it('marks fence edges and contents as inFence', () => {
		const lines = annotateFences(['a', '```js', 'code', '```', 'b']);
		expect(lines.map((l) => l.inFence)).toEqual([false, true, true, true, false]);
		expect(toText(lines)).toBe('a\n```js\ncode\n```\nb');
	});
});

describe('splitFrontmatter', () => {
	it('separates carried-over keys from the rest', () => {
		const { frontmatter, fields, body } = splitFrontmatter(
			'---\ntitle: Hi\nsidebar_position: 3\n---\nbody\n'
		);
		expect(frontmatter).toEqual({ title: 'Hi' });
		expect(fields.sidebar_position).toBe('3');
		expect(body).toBe('body\n');
	});

	it('passes through pages without frontmatter', () => {
		expect(splitFrontmatter('just text').body).toBe('just text');
	});
});

describe('hoistLeadingH1', () => {
	it('lifts a leading h1 and strips inline markup', () => {
		expect(hoistLeadingH1('# The `CLI` {#cli}\n\nrest')).toEqual({
			title: 'The CLI',
			body: 'rest'
		});
	});

	it('leaves pages that do not start with an h1', () => {
		expect(hoistLeadingH1('text\n# later').title).toBeNull();
	});
});

describe('rewriteLinks', () => {
	it('absolutizes relative links and drops .md extensions', () => {
		expect(rewriteLinks('[a](./other.md) [b](../up/page.mdx#x) [c](https://x.y)', 'guides')).toBe(
			'[a](/docs/guides/other) [b](/docs/up/page#x) [c](https://x.y)'
		);
	});
});

describe('stripImports + assemblePage', () => {
	it('emits .svx with imports only for components the page uses', () => {
		const annotated = annotateFences([
			"import { Callout } from 'fumadocs-ui/components/callout';",
			'',
			'<Callout type="info">hi</Callout>'
		]);
		const { lines, identifiers } = stripImports(annotated, new Set(['Callout']));
		expect(identifiers.size).toBe(0);
		const page = assemblePage({ title: 'T' }, lines);
		expect(page.ext).toBe('.svx');
		expect(page.content).toContain("import Callout from '$lib/components/Callout.svelte';");
		expect(page.content.startsWith('---\ntitle: T\n---')).toBe(true);
	});

	it('emits plain .md when no component is used', () => {
		const page = assemblePage({}, annotateFences(['plain']));
		expect(page).toEqual({ ext: '.md', content: 'plain\n' });
	});
});
