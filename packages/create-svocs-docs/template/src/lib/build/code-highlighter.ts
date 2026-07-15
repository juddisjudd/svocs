import { code_highlighter } from 'mdsvex';

function escapeAttribute(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
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
 * This reuses the stock highlighter output byte-for-byte and only injects a
 * `data-filename` attribute onto the opening `<pre>` tag when present, so
 * Prism highlighting and the `{@html ...}` optimisation wrapper stay intact.
 */
export async function highlightWithFilename(
	code: string,
	lang: string | null | undefined,
	metastring: string | null | undefined,
	filename?: string,
	optimise?: boolean
): Promise<string> {
	const html = await code_highlighter(code, lang, metastring, filename, optimise);

	const match = metastring?.match(/filename="([^"]+)"/);
	if (!match) {
		return html;
	}

	return html.replace(
		'<pre class="language-',
		`<pre data-filename="${escapeAttribute(match[1])}" class="language-`
	);
}
