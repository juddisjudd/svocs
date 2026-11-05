import { compile } from 'mdsvex';
import { describe, expect, it } from 'vitest';
import { extractTocFromMarkdown } from '../server/content';
import { rehypeHeadingIds } from './heading-ids';

const SOURCE = [
	'---',
	'title: States',
	'---',
	'',
	'<script>',
	"\timport Callout from '#lib/components/Callout.svelte';",
	'</script>',
	'',
	'## group.\\<name\\>',
	'',
	'## \\<name\\>:count',
	'',
	'## Fish & chips',
	'',
	'## Fish & chips'
].join('\n');

type RehypePlugin = NonNullable<
	NonNullable<Parameters<typeof compile>[1]>['rehypePlugins']
>[number];

describe('rehypeHeadingIds', () => {
	it('gives headings the same ids the TOC links to', async () => {
		const compiled = await compile(SOURCE, {
			rehypePlugins: [rehypeHeadingIds() as unknown as RehypePlugin]
		});
		const rendered = [...(compiled?.code ?? '').matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
		const toc = extractTocFromMarkdown(SOURCE).map((item) => item.id);
		expect(rendered).toEqual(['groupname', 'namecount', 'fish--chips', 'fish--chips-1']);
		expect(rendered).toEqual(toc);
	});
});
