import { describe, expect, it } from 'vitest';
import { transformObsidian, type ObsidianResolver } from './obsidian';

const resolver: ObsidianResolver = {
	resolveNote: (target) =>
		({ 'getting started': '/docs/getting-started', 'guides/writing': '/docs/guides/writing' })[
			target.toLowerCase()
		] ?? null,
	resolveAsset: (name) => (name === 'diagram.png' ? '/images/diagram.png' : null)
};

const run = (source: string) => {
	const warnings: string[] = [];
	const code = transformObsidian(source, resolver, { warn: (m) => warnings.push(m) });
	return { code, warnings };
};

describe('wikilinks', () => {
	it('resolves notes, aliases and heading anchors', () => {
		expect(run('See [[Getting Started]] and [[guides/writing|the guide]].').code).toBe(
			'See [Getting Started](/docs/getting-started) and [the guide](/docs/guides/writing).'
		);
		expect(run('[[Getting Started#Add a page]]').code).toBe(
			'[Getting Started](/docs/getting-started#add-a-page)'
		);
		expect(run('[[#Local Heading]]').code).toBe('[Local Heading](#local-heading)');
	});

	it('leaves unresolved links alone and warns', () => {
		const { code, warnings } = run('[[Nowhere]]');
		expect(code).toBe('[[Nowhere]]');
		expect(warnings).toEqual(['wikilink target not found: Nowhere']);
	});

	it('never touches code', () => {
		const source = 'Use `[[x]]` here.\n\n```md\n[[Getting Started]]\n==hi==\n```\n';
		expect(run(source).code).toBe(source);
	});
});

describe('embeds', () => {
	it('turns image embeds into images, with optional width', () => {
		expect(run('![[diagram.png]]').code).toBe('![diagram](/images/diagram.png)');
		expect(run('![[diagram.png|320]]').code).toBe(
			'<img src="/images/diagram.png" alt="diagram" width="320" />'
		);
	});

	it('links note embeds instead of transcluding', () => {
		const { code, warnings } = run('![[Getting Started]]');
		expect(code).toBe('[Getting Started](/docs/getting-started)');
		expect(warnings[0]).toMatch(/transcluded/);
	});
});

describe('callouts', () => {
	it('converts a titled callout and injects the import', () => {
		const { code } = run(
			'---\ntitle: T\n---\n> [!tip] Pro tip\n> Use ==this==.\n> And [[Getting Started]].\n\nAfter.'
		);
		expect(code).toBe(
			[
				'---',
				'title: T',
				'---',
				'<script>',
				"\timport Callout from '#lib/components/Callout.svelte';",
				'</script>',
				'',
				'<Callout type="tip">',
				'',
				'**Pro tip**',
				'',
				'Use <mark>this</mark>.',
				'And [Getting Started](/docs/getting-started).',
				'',
				'</Callout>',
				'',
				'After.'
			].join('\n')
		);
	});

	it('maps unknown and foldable types, reusing an existing script block', () => {
		const { code } = run(
			"<script>\n\timport Tabs from '#lib/components/Tabs.svelte';\n</script>\n\n> [!bug]- Folded\n> body"
		);
		expect(code).toContain(
			"<script>\n\timport Callout from '#lib/components/Callout.svelte';\n\timport Tabs"
		);
		expect(code).toContain('<Callout type="danger">');
	});

	it('leaves ordinary blockquotes alone', () => {
		expect(run('> just a quote ==x==').code).toBe('> just a quote <mark>x</mark>');
	});
});

describe('comments', () => {
	it('strips inline and block comments', () => {
		expect(run('keep %% drop %% keep').code).toBe('keep  keep');
		expect(run('a\n%%\nhidden\n%%\nb').code).toBe('a\nb');
	});
});

describe('passthrough', () => {
	it('returns the source untouched when nothing applies', () => {
		const source = '---\ntitle: X\n---\n\nPlain **markdown**.\n';
		expect(run(source).code).toBe(source);
	});
});
