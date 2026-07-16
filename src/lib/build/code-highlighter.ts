import { code_highlighter } from 'mdsvex';

// Curlies must be escaped in both helpers: this output is compiled as Svelte
// template markup, where a bare `{` opens an expression.
function escapeAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/\{/g, '&#123;')
		.replace(/\}/g, '&#125;');
}

function escapeText(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\{/g, '&#123;')
		.replace(/\}/g, '&#125;');
}

/**
 * Wraps mdsvex's default Prism-based highlighter to support a filename
 * annotation on fenced code blocks:
 *
 * ```sh filename="deploy.sh"
 * ...
 * ```
 *
 * mdsvex already threads the fence's meta string through to a custom
 * `highlight.highlighter`, it just doesn't do anything with it by default.
 * This reuses the stock highlighter output byte-for-byte, injects a
 * `data-filename` attribute onto the opening `<pre>` tag when present, and
 * emits the .code-frame / .code-frame-header / .code-frame-body wrapper
 * around the block, so Prism highlighting and the `{@html ...}` optimisation
 * wrapper stay intact.
 *
 * The frame markup MUST be emitted here at build time, not wrapped around
 * the `<pre>` client-side: the `<pre>` is part of the mdsvex-compiled Svelte
 * component's fragment, and re-parenting it at runtime corrupts Svelte's
 * teardown when the block is the fragment's boundary node (a doc ending in a
 * code fence) — after which every client-side navigation renders doc bodies
 * into a detached anchor, i.e. blank pages until a full reload. The
 * client-side enhanceCodeBlocks() (src/lib/themes/docs/code-blocks.ts) only
 * appends a copy button inside .code-frame-body, which is safe.
 */
export async function highlightWithFilename(
	code: string,
	lang: string | null | undefined,
	metastring: string | null | undefined,
	filename?: string,
	optimise?: boolean
): Promise<string> {
	// Mermaid fences skip highlighting and the code-frame entirely: the raw
	// source ships as a bare <pre class="mermaid"> that the docs layout's
	// lazy client-side renderer (src/lib/themes/docs/mermaid.ts) turns into a
	// diagram in place. Rendering at build time instead would put a headless
	// browser back into every diagram-using build.
	if (lang === 'mermaid') {
		return `<pre class="mermaid">${escapeText(code)}</pre>`;
	}

	const html = await code_highlighter(code, lang, metastring, filename, optimise);

	const name = metastring?.match(/filename="([^"]+)"/)?.[1];
	const pre = name
		? html.replace(
				'<pre class="language-',
				`<pre data-filename="${escapeAttribute(name)}" class="language-`
			)
		: html;
	const header = name
		? `<div class="code-frame-header"><span>${escapeText(name)}</span></div>`
		: '';

	return `<div class="code-frame">${header}<div class="code-frame-body">${pre}</div></div>`;
}
