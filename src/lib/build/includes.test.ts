import { describe, expect, it } from 'vitest';
import { extractSection, inlineIncludes } from './includes';

const files: Record<string, string> = {
	'/content/lib/ped.svx': [
		'---',
		'title: Ped',
		'---',
		'',
		'<script>',
		"\timport { Tabs, Tab } from '#lib/components';",
		"\timport Callout from '#lib/components/Callout.svelte';",
		"\timport IncludeEntity from './entity.svx';",
		'</script>',
		'',
		'## Constructor',
		'',
		'Not included.',
		'',
		'## Methods',
		'<section id="pedmethods">',
		'',
		'### getArmour',
		'',
		'<Tabs><Tab>lua</Tab></Tabs>',
		'',
		'<IncludeEntity />',
		'</section>',
		''
	].join('\n'),
	'/content/lib/entity.svx': '## Entity Methods\n\n### set\n\nWrites a value.\n',
	'/content/lib/loop.md': '## Loop\n\n<include>./loop.md#loop</include>\n',
	'/content/guide/notes.md':
		'# Notes\n\n## Setup\n\nInstall it.\n\n### Details\n\nMore.\n\n## Usage\n\nUse it.\n'
};
const load = (path: string) => files[path];

describe('extractSection', () => {
	const body = '## A\n\none\n\n### A.1\n\ntwo\n\n## B\n\nthree\n';

	it('takes a heading and everything under it down to the next heading at its level', () => {
		expect(extractSection(body, 'a')).toBe('## A\n\none\n\n### A.1\n\ntwo\n');
		expect(extractSection(body, 'b')).toBe('## B\n\nthree\n');
	});

	it('takes the children of a section element, nested sections included', () => {
		const html = 'x\n<section id="s">\n\nin <section>deep</section>\n</section>\nout';
		expect(extractSection(html, 's')).toBe('\n\nin <section>deep</section>\n');
	});

	it('ignores headings and sections inside code fences', () => {
		expect(extractSection('```md\n## A\n```\n\ntext', 'a')).toBeUndefined();
	});
});

describe('inlineIncludes', () => {
	it('inlines a section and imports the components it uses', () => {
		const host =
			'---\ntitle: Player\n---\n\n## Ped Methods\n\n<include>../lib/ped.svx#pedmethods</include>\n';
		const { code, dependencies, errors } = inlineIncludes(host, '/content/api/player.md', load);

		expect(errors).toEqual([]);
		expect(dependencies).toEqual(['/content/lib/ped.svx']);
		expect(code).toContain('### getArmour');
		expect(code).not.toContain('Not included');
		expect(code).toMatch(/^---\ntitle: Player\n---\n<script>\n/);
		expect(code).toContain("\timport { Tabs, Tab } from '#lib/components';");
		expect(code).toContain("\timport IncludeEntity from '../lib/entity.svx';");
		expect(code).not.toContain('Callout');
	});

	it('skips imports the host page already has', () => {
		const host =
			"<script>\n\timport { Tabs, Tab } from '#lib/components';\n</script>\n\n<include>./ped.svx#pedmethods</include>\n";
		const { code } = inlineIncludes(host, '/content/lib/player.svx', load);

		expect(code.match(/import \{ Tabs/g)).toHaveLength(1);
		expect(code).toContain(
			"<script>\n\timport IncludeEntity from './entity.svx';\n\timport { Tabs"
		);
	});

	it('inlines a whole page or a heading section', () => {
		const whole = inlineIncludes('<include>./notes.md</include>', '/content/guide/a.md', load);
		expect(whole.code.trim()).toBe(files['/content/guide/notes.md'].trim());

		const setup = inlineIncludes(
			'<include>./notes.md#setup</include>',
			'/content/guide/a.md',
			load
		);
		expect(setup.code.trim()).toBe('## Setup\n\nInstall it.\n\n### Details\n\nMore.');
	});

	it('leaves includes in code alone', () => {
		const source = '```md\n<include>./notes.md</include>\n```\n\n`<include>./notes.md</include>`\n';
		expect(inlineIncludes(source, '/content/guide/a.md', load).code).toBe(source);
	});

	it('reports missing pages, missing sections and cycles', () => {
		const run = (source: string) => inlineIncludes(source, '/content/lib/host.md', load).errors;

		expect(run('<include>./nope.md</include>')).toEqual([
			'<include>./nope.md</include>: no page at that path'
		]);
		expect(run('<include>./ped.svx#nope</include>')[0]).toContain('no <section id="nope">');
		expect(run('<include>./loop.md</include>')[0]).toContain('includes itself');
		expect(run('<include>./code.ts</include>')[0]).toContain('only .md and .svx');
	});
});
