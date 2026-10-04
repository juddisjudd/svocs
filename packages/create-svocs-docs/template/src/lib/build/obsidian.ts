/**
 * Obsidian-flavoured markdown for content/. Runs as a Svelte markup
 * preprocessor ahead of mdsvex, so a vault can be opened directly on
 * content/ and its notes build unchanged:
 *
 *   [[Note]], [[Note|label]], [[Note#Heading]]  → markdown links to /docs/…
 *   ![[image.png]], ![[image.png|320]]         → images served from static/
 *   > [!tip] Title  … callouts                 → <Callout type="tip">
 *   ==highlight==                              → <mark>
 *   %% comments %%                             → removed
 *
 * Fenced code, inline code, frontmatter and <script>/<style> blocks are
 * never touched. Unresolved links are left as written and reported.
 */
import { readdirSync, type Dirent } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import GithubSlugger from 'github-slugger';
import type { PreprocessorGroup } from 'svelte/compiler';

export type ObsidianResolver = {
	/** Route for a note reference (`Guides/Writing`, `writing`), or null. */
	resolveNote(target: string): string | null;
	/** Public URL for an attachment file name, or null. */
	resolveAsset(name: string): string | null;
};

type Options = {
	warn?: (message: string) => void;
};

const CALLOUT_TYPES: Record<string, string> = {
	note: 'note',
	abstract: 'note',
	summary: 'note',
	tldr: 'note',
	quote: 'note',
	cite: 'note',
	info: 'info',
	todo: 'info',
	question: 'info',
	help: 'info',
	faq: 'info',
	example: 'info',
	tip: 'tip',
	hint: 'tip',
	important: 'tip',
	success: 'tip',
	check: 'tip',
	done: 'tip',
	warning: 'warning',
	caution: 'warning',
	attention: 'warning',
	danger: 'danger',
	error: 'danger',
	bug: 'danger',
	failure: 'danger',
	fail: 'danger',
	missing: 'danger'
};

const IMAGE_RE = /\.(png|jpe?g|gif|svg|webp|avif)$/i;
const CALLOUT_IMPORT = "import Callout from '#lib/components/Callout.svelte';";

function splitFrontmatter(source: string): { frontmatter: string; body: string } {
	const match = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	return match
		? { frontmatter: match[0], body: source.slice(match[0].length) }
		: { frontmatter: '', body: source };
}

/** Apply `fn` to the parts of a line outside inline code spans. */
function outsideCode(line: string, fn: (text: string) => string): string {
	return line
		.split(/(`+[^`]*`+)/)
		.map((part, i) => (i % 2 === 1 ? part : fn(part)))
		.join('');
}

/**
 * Like outsideCode, but also leaves Svelte `{…}` expressions alone — in a
 * .svx page, `rows={[["a", 1]]}` or `{a == b}` is code, not a wikilink or a
 * highlight. `state.depth` carries an open expression across lines.
 */
function outsideCodeAndExpressions(
	line: string,
	state: { depth: number },
	fn: (text: string) => string
): string {
	let out = '';
	let text = '';
	let quote: string | null = null;
	const flushText = () => {
		out += text ? fn(text) : '';
		text = '';
	};
	for (let i = 0; i < line.length; i += 1) {
		const char = line[i];
		if (state.depth > 0) {
			out += char;
			if (quote) {
				if (char === '\\') {
					out += line[++i] ?? '';
				} else if (char === quote) {
					quote = null;
				}
			} else if (char === '"' || char === "'" || char === '`') {
				quote = char;
			} else if (char === '{') {
				state.depth += 1;
			} else if (char === '}') {
				state.depth -= 1;
			}
			continue;
		}
		if (char === '`') {
			const run = line.slice(i).match(/^`+/)![0];
			const close = line.indexOf(run, i + run.length);
			if (close !== -1) {
				flushText();
				out += line.slice(i, close + run.length);
				i = close + run.length - 1;
				continue;
			}
		}
		if (char === '{') {
			flushText();
			out += char;
			state.depth = 1;
			continue;
		}
		text += char;
	}
	flushText();
	return out;
}

function headingAnchor(heading: string): string {
	return `#${new GithubSlugger().slug(heading.trim())}`;
}

function convertInline(
	text: string,
	resolver: ObsidianResolver,
	warn: (m: string) => void
): string {
	let out = text.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');

	// embeds first so the image regex doesn't see a bare [[…]]
	out = out.replace(/!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (full, target, param) => {
		const name = target.trim();
		if (IMAGE_RE.test(name)) {
			const url = resolver.resolveAsset(name);
			if (!url) {
				warn(`attachment not found under static/: ${name}`);
				return full;
			}
			const alt = basename(name, extname(name));
			const width = param && /^\d+$/.test(param.trim()) ? param.trim() : null;
			return width ? `<img src="${url}" alt="${alt}" width="${width}" />` : `![${alt}](${url})`;
		}
		const route = resolver.resolveNote(name);
		if (!route) {
			warn(`embedded note not found: ${name}`);
			return full;
		}
		warn(`note embeds aren't transcluded; linking to ${name} instead`);
		return `[${param?.trim() || name}](${route})`;
	});

	out = out.replace(
		/\[\[([^\]|#]*)(#[^\]|]*)?(?:\|([^\]]*))?\]\]/g,
		(full, target, hash, alias) => {
			const name = target.trim();
			const label = alias?.trim() || (name ? name.split('/').pop() : hash?.slice(1)) || full;
			const anchor = hash ? headingAnchor(hash.slice(1)) : '';
			if (!name) {
				return `[${label}](${anchor})`;
			}
			const route = resolver.resolveNote(name);
			if (!route) {
				warn(`wikilink target not found: ${name}`);
				return full;
			}
			return `[${label}](${route}${anchor})`;
		}
	);

	return out;
}

export function transformObsidian(
	source: string,
	resolver: ObsidianResolver,
	options: Options = {}
): string {
	const warn = options.warn ?? (() => {});
	const { frontmatter, body } = splitFrontmatter(source);
	if (!/\[\[|\[!|==|%%/.test(body)) {
		return source;
	}

	const lines = body.split(/\r?\n/);
	const out: string[] = [];
	let inFence: string | null = null;
	let inRaw = false; // <script> / <style>
	let inComment = false;
	let usedCallout = false;
	const expression = { depth: 0 };

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		const fence = line.match(/^\s*(```+|~~~+)/);

		if (inFence) {
			out.push(line);
			if (fence && fence[1].startsWith(inFence[0]) && fence[1].length >= inFence.length) {
				inFence = null;
			}
			continue;
		}
		if (fence) {
			inFence = fence[1];
			out.push(line);
			continue;
		}
		if (inRaw) {
			out.push(line);
			if (/<\/(script|style)>/.test(line)) {
				inRaw = false;
			}
			continue;
		}
		if (/^\s*<(script|style)(\s[^>]*)?>/.test(line) && !/<\/(script|style)>/.test(line)) {
			inRaw = true;
			out.push(line);
			continue;
		}

		// %% comments %% — single or multi-line, outside code
		let text = line;
		if (inComment) {
			const end = text.indexOf('%%');
			if (end === -1) {
				continue;
			}
			text = text.slice(end + 2);
			inComment = false;
		}
		text = outsideCode(text, (part) => part.replace(/%%[^%]*?%%/g, ''));
		const open = text.indexOf('%%');
		if (open !== -1 && !/`[^`]*%%[^`]*`/.test(text)) {
			text = text.slice(0, open);
			inComment = true;
		}

		// a line that was only a comment disappears entirely
		if (text.trim() === '' && line.trim() !== '') {
			continue;
		}

		// callouts: `> [!type] Title` followed by `> body` lines
		const callout = text.match(/^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)$/);
		if (callout) {
			const type = CALLOUT_TYPES[callout[1].toLowerCase()] ?? 'note';
			const title = callout[3].trim();
			const bodyLines: string[] = [];
			while (i + 1 < lines.length && /^>(\s|$)/.test(lines[i + 1])) {
				i += 1;
				bodyLines.push(
					outsideCode(lines[i].replace(/^>\s?/, ''), (part) => part.replace(/%%[^%]*?%%/g, ''))
				);
			}
			usedCallout = true;
			out.push(`<Callout type="${type}">`, '');
			if (title) {
				out.push(`**${convertInline(title, resolver, warn)}**`, '');
			}
			for (const bodyLine of bodyLines) {
				out.push(
					outsideCodeAndExpressions(bodyLine, expression, (part) =>
						convertInline(part, resolver, warn)
					)
				);
			}
			out.push('', '</Callout>');
			continue;
		}

		out.push(
			outsideCodeAndExpressions(text, expression, (part) => convertInline(part, resolver, warn))
		);
	}

	let result = out.join('\n');

	if (
		usedCallout &&
		!/Callout\.svelte|\bCallout\b[^\n]*from\s+['"]#lib\/components['"]/.test(result)
	) {
		const scriptOpen = result.match(/^<script(\s[^>]*)?>\s*$/m);
		if (scriptOpen && scriptOpen.index !== undefined) {
			const at = scriptOpen.index + scriptOpen[0].length;
			result = `${result.slice(0, at)}\n\t${CALLOUT_IMPORT}${result.slice(at)}`;
		} else {
			result = `<script>\n\t${CALLOUT_IMPORT}\n</script>\n\n${result}`;
		}
	}

	return `${frontmatter}${result}`;
}

// ---- resolver backed by the content/ and static/ trees

function walk(dir: string, out: string[] = []): string[] {
	let entries: Dirent[];
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (entry.name.startsWith('.')) {
			continue;
		}
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, out);
		} else {
			out.push(full);
		}
	}
	return out;
}

const INDEX_TTL_MS = 2000;

export function createObsidianResolver({
	contentDir = resolve('content'),
	staticDir = resolve('static')
}: { contentDir?: string; staticDir?: string } = {}): ObsidianResolver {
	let builtAt = 0;
	let notes = new Map<string, string>();
	let assets = new Map<string, string>();

	function refresh() {
		if (Date.now() - builtAt < INDEX_TTL_MS) {
			return;
		}
		builtAt = Date.now();
		notes = new Map();
		assets = new Map();

		for (const file of walk(contentDir)) {
			if (!/\.(md|svx)$/.test(file) || /[\\/]_meta\.(md|svx)$/.test(file)) {
				continue;
			}
			const rel = relative(contentDir, file)
				.split(sep)
				.join('/')
				.replace(/\.(md|svx)$/, '');
			const slug = rel === 'index' ? '' : rel.replace(/\/index$/, '');
			const route = slug ? `/docs/${slug}` : '/docs';
			notes.set(rel.toLowerCase(), route);
			const name = rel.split('/').pop()!.toLowerCase();
			// first match wins on basename collisions, same as Obsidian's
			// "shortest path" default for unambiguous names
			if (!notes.has(name)) {
				notes.set(name, route);
			}
			if (name === 'index') {
				const folder = rel.split('/').slice(-2, -1)[0];
				if (folder && !notes.has(folder.toLowerCase())) {
					notes.set(folder.toLowerCase(), route);
				}
			}
		}

		for (const file of walk(staticDir)) {
			const rel = relative(staticDir, file).split(sep).join('/');
			const name = basename(rel).toLowerCase();
			assets.set(rel.toLowerCase(), `/${rel}`);
			if (!assets.has(name)) {
				assets.set(name, `/${rel}`);
			}
		}
	}

	return {
		resolveNote(target) {
			refresh();
			const key = target
				.trim()
				.replace(/^\.?\//, '')
				.replace(/\.md$/i, '')
				.toLowerCase();
			return notes.get(key) ?? notes.get(key.replace(/\s+/g, '-')) ?? null;
		},
		resolveAsset(name) {
			refresh();
			const key = name
				.trim()
				.replace(/^\.?\//, '')
				.toLowerCase();
			return assets.get(key) ?? assets.get(basename(key)) ?? null;
		}
	};
}

/** Svelte preprocessor; list it before mdsvex. */
export function obsidian(
	options: { contentDir?: string; staticDir?: string } = {}
): PreprocessorGroup {
	const contentDir = resolve(options.contentDir ?? 'content');
	const resolver = createObsidianResolver({ contentDir, staticDir: options.staticDir });
	return {
		name: 'svocs-obsidian',
		markup({ content, filename }) {
			if (!filename || !/\.(md|svx)$/.test(filename)) {
				return undefined;
			}
			if (!resolve(filename).startsWith(contentDir + sep)) {
				return undefined;
			}
			const rel = relative(contentDir, filename);
			const code = transformObsidian(content, resolver, {
				warn: (message) => console.warn(`[svocs] content/${rel}: ${message}`)
			});
			return code === content ? undefined : { code };
		}
	};
}
