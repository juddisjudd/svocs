import { compile } from 'mdsvex';
import { describe, expect, it } from 'vitest';
import { highlightWithFilename } from './code-highlighter';

describe('highlightWithFilename', () => {
	it('keeps every backslash in code, inside and outside the {@html} literal', async () => {
		const code = 'npx tool \\\n  --flag\ngrep -E "\\d+\\s" \\u0041 "\\\\"';
		for (const optimise of [true, false]) {
			const html = await highlightWithFilename(code, 'sh', null, undefined, optimise);
			expect(html).not.toContain('\\');
			expect(html.match(/&#92;/g)).toHaveLength(6);
		}
	});

	it('survives a full mdsvex compile with the line continuation intact', async () => {
		const source = '```sh\nnpx tool \\\n  --flag\n```';
		const compiled = await compile(source, {
			highlight: { highlighter: highlightWithFilename, optimise: true }
		});
		expect(compiled?.code).toContain('npx tool &#92;\n  --flag');
	});
});
