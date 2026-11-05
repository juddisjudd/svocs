import { describe, expect, it } from 'vitest';
import {
	annotateFences,
	assemblePage,
	hoistLeadingH1,
	includeTag,
	resolveIncludes,
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

	it('retries a dead file-relative link against the source page URL', () => {
		const routes = new Set(['/docs', '/docs/guides', '/docs/guides/git', '/docs/ox_core']);
		const links = { dir: 'ox_core', urlBase: ['docs'], routes };
		expect(rewriteLinks('[a](../docs/guides/git) [b](./missing)', links)).toBe(
			'[a](/docs/guides/git) [b](/docs/ox_core/missing)'
		);
	});

	it('keeps a live file-relative link even when the URL reading differs', () => {
		const routes = new Set(['/docs/ox_core/setup', '/docs/setup']);
		const links = { dir: 'ox_core', urlBase: ['docs'], routes };
		expect(rewriteLinks('[a](./setup)', links)).toBe('[a](/docs/ox_core/setup)');
	});

	it('leaves angle-bracket destinations alone', () => {
		const text = '[p](<http://x.y/a_(b)>)';
		expect(rewriteLinks(text, 'guides')).toBe(text);
	});
});

describe('resolveIncludes', () => {
	const outRels = new Map([['resources/tebex.mdx', 'resources/tebex.md']]);

	it('imports the included page and adds a script after the frontmatter', () => {
		const page = `---\ntitle: T\n---\n\n${includeTag('resources/tebex.mdx')}\n`;
		const { content, missing, imported } = resolveIncludes(page, 'introduction.md', outRels);
		expect(imported).toBe(true);
		expect(missing).toEqual([]);
		expect(content).toBe(
			"---\ntitle: T\n---\n\n<script>\n\timport IncludeTebex from './resources/tebex.md';\n</script>\n\n<IncludeTebex />\n"
		);
	});

	it('joins an existing instance script and imports relative to the page', () => {
		const page = `<script>\n\timport Cards from '#lib/components/Cards.svelte';\n</script>\n\n${includeTag('resources/tebex.mdx')}\n`;
		const { content } = resolveIncludes(page, 'guides/index.svx', outRels);
		expect(content).toContain(
			"<script>\n\timport IncludeTebex from '../resources/tebex.md';\n\timport Cards"
		);
	});

	it('flags an include that is not a migrated page', () => {
		const { content, missing, imported } = resolveIncludes(includeTag('nope.mdx'), 'a.md', outRels);
		expect(imported).toBe(false);
		expect(missing).toEqual(['nope.mdx']);
		expect(content).toContain('svocs migrate TODO');
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
		expect(page.content).toContain("import Callout from '#lib/components/Callout.svelte';");
		expect(page.content.startsWith('---\ntitle: T\n---')).toBe(true);
	});

	it('emits plain .md when no component is used', () => {
		const page = assemblePage({}, annotateFences(['plain']));
		expect(page).toEqual({ ext: '.md', content: 'plain\n' });
	});

	it('merges imports into a page that already has a script, without duplicates', () => {
		const page = assemblePage(
			{},
			annotateFences([
				'<script>',
				"\timport { Step, Steps } from './docs';",
				'</script>',
				'',
				'<Steps>',
				'',
				'<Callout>hi</Callout>',
				'',
				'</Steps>'
			])
		);
		expect(page.ext).toBe('.svx');
		expect(page.content.match(/<script>/g)).toHaveLength(1);
		expect(page.content).toContain(
			"<script>\n\timport Callout from '#lib/components/Callout.svelte';"
		);
		expect(page.content).not.toContain("import Steps from '#lib/components/Steps.svelte'");
	});

	it('keeps a page with its own script as .svx even without known components', () => {
		const page = assemblePage(
			{},
			annotateFences(['<script>', '\tlet n = 1;', '</script>', '', '{n}'])
		);
		expect(page).toEqual({ ext: '.svx', content: '<script>\n\tlet n = 1;\n</script>\n\n{n}\n' });
	});
});
