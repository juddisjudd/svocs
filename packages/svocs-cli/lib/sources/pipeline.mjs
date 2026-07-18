// Shared conversion machinery for `svocs migrate` source adapters.
// Everything line-based works on { text, inFence } annotated lines so
// transforms never touch fenced code.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Components the svocs template ships. A converted page that uses any of
// these becomes .svx with the matching imports; everything else stays .md.
export const KNOWN_COMPONENTS = new Set([
	'Callout',
	'Tabs',
	'Tab',
	'Steps',
	'Cards',
	'Card',
	'Collapse',
	'Banner',
	'Bleed',
	'FileTree',
	'FileTreeFolder',
	'FileTreeFile'
]);

// Raw-JSX constructs Svelte can't compile (style objects, JSX whitespace
// hacks, React attribute spellings).
export const RAW_JSX_RE = /style=\{\{|\{" "\}|className=/;

export const blankLine = () => ({ text: '', inFence: false });

// ---- fence-aware line utilities

/** Split lines into { text, inFence } so transforms never touch code. */
export function annotateFences(lines) {
	let inFence = false;
	return lines.map((text) => {
		const isFenceEdge = /^\s*(```|~~~)/.test(text);
		const annotated = { text, inFence: inFence || isFenceEdge };
		if (isFenceEdge) {
			inFence = !inFence;
		}
		return annotated;
	});
}

export function toText(annotated) {
	return annotated.map((line) => line.text).join('\n');
}

// ---- frontmatter

/**
 * Split a page into frontmatter and body. `frontmatter` holds only the keys
 * svocs carries over (title, description); `fields` holds every flat
 * `key: value` pair for adapters that read framework-specific keys; `raw` is
 * the untouched block for nested lookups.
 */
export function splitFrontmatter(source) {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) {
		return { frontmatter: {}, fields: {}, raw: '', body: source };
	}
	const fields = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
		if (kv && kv[2].trim() !== '') {
			fields[kv[1]] = kv[2].trim();
		}
	}
	const frontmatter = {};
	for (const key of ['title', 'description']) {
		if (fields[key]) {
			frontmatter[key] = fields[key];
		}
	}
	return { frontmatter, fields, raw: match[1], body: source.slice(match[0].length) };
}

/** Quote a value for the emitted YAML frontmatter only when it needs it. */
export function yamlValue(value) {
	return /^[A-Za-z0-9][^:#'"`{}[\]|>&*!?%@\n]*$/.test(value) && !/\s$/.test(value)
		? value
		: JSON.stringify(value);
}

/**
 * The svocs layout renders the page title itself, so sources whose pages
 * start with `# Title` (MkDocs, mdBook, some Docusaurus) hoist that heading
 * into frontmatter instead of rendering it twice.
 */
export function hoistLeadingH1(body) {
	const lines = body.split(/\r?\n/);
	let i = 0;
	while (i < lines.length && lines[i].trim() === '') {
		i += 1;
	}
	const match = lines[i]?.match(/^#\s+(.*)$/);
	if (!match) {
		return { title: null, body };
	}
	const title = match[1]
		.trim()
		.replace(/\s*\{#[\w-]+\}\s*$/, '')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[`*_]/g, '');
	lines.splice(i, 1);
	while (lines[i] !== undefined && lines[i].trim() === '') {
		lines.splice(i, 1);
	}
	return { title, body: lines.join('\n') };
}

// ---- MDX passes (shared by fumadocs / nextra / docusaurus / starlight)

/**
 * Strip MDX preamble imports (outside fences); return the identifiers that
 * were imported minus `mapped` — names the adapter knows how to convert and
 * that therefore shouldn't trigger the unportable-block pass.
 */
export function stripImports(annotated, mapped = new Set()) {
	const identifiers = new Set();
	const kept = [];
	for (const line of annotated) {
		const importMatch = line.inFence
			? null
			: line.text.match(/^import\s+(.+?)\s+from\s+["'][^"']+["'];?\s*$/);
		if (!importMatch) {
			kept.push(line);
			continue;
		}
		for (const name of importMatch[1].replace(/[{}]/g, '').split(',')) {
			const cleaned = name
				.trim()
				.split(/\s+as\s+/)
				.pop();
			if (cleaned && !mapped.has(cleaned)) {
				identifiers.add(cleaned);
			}
		}
	}
	return { lines: kept, identifiers };
}

/**
 * MDX tolerates indented JSX children and content butted against tags;
 * mdsvex reads indentation as markdown (4 spaces = code block) and needs
 * blank lines between a tag and its markdown content. Dedent known-component
 * regions and pad the tags with blank lines.
 */
export function normalizeComponents(annotated) {
	const names = [...KNOWN_COMPONENTS].join('|');
	// (?<!/) excludes self-closing tags (<Cards auto />) — without it they're
	// read as an opening tag with no matching close, and every line for the
	// rest of the file gets dedented looking for one.
	const openRe = new RegExp(`^(\\s*)<(${names})(\\s[^>]*)?(?<!/)>\\s*$`);
	const closeRe = new RegExp(`^(\\s*)</(${names})>\\s*$`);
	const out = [];
	const dedents = [];

	const padIfNeeded = () => {
		if (out.length > 0 && out[out.length - 1].text.trim() !== '') {
			out.push(blankLine());
		}
	};

	for (const line of annotated) {
		if (!line.inFence && closeRe.test(line.text)) {
			padIfNeeded();
			out.push({ text: line.text.trim(), inFence: false });
			out.push(blankLine());
			dedents.pop();
			continue;
		}
		const open = line.inFence ? null : line.text.match(openRe);
		if (open) {
			padIfNeeded();
			out.push({ text: line.text.trim(), inFence: false });
			out.push(blankLine());
			// children in the wild are indented one 2-space step past the tag
			dedents.push(open[1].length + 2);
			continue;
		}
		if (dedents.length > 0) {
			const n = dedents[dedents.length - 1];
			out.push({ ...line, text: line.text.replace(new RegExp(`^ {1,${n}}`), '') });
		} else {
			out.push(line);
		}
	}
	return out;
}

/**
 * Comment out contiguous blocks (outside fences) that reference stripped
 * imports or contain raw JSX. The original block is preserved inside the
 * comment so porting it is copy-paste work.
 */
export function commentUnportableBlocks(annotated, identifiers, todos) {
	const identifierRe =
		identifiers.size > 0 ? new RegExp(`[<{][\\s/]*(${[...identifiers].join('|')})\\b`) : null;
	const out = [];
	let block = [];

	const flush = () => {
		if (block.length === 0) {
			return;
		}
		const blockText = block.map((l) => l.text).join('\n');
		const needsPorting =
			(identifierRe && identifierRe.test(blockText)) || RAW_JSX_RE.test(blockText);
		if (needsPorting) {
			todos.push(block[0].text.trim().slice(0, 60));
			// inFence: true shields the commented lines from every later
			// transform pass, keeping the comment byte-stable.
			out.push({
				text: '<!-- svocs migrate TODO: port this site-specific block manually:',
				inFence: true
			});
			out.push(...block.map((l) => ({ text: l.text.replace(/--+/g, '·'), inFence: true })));
			out.push({ text: '-->', inFence: true });
		} else {
			out.push(...block);
		}
		block = [];
	};

	for (const line of annotated) {
		if (!line.inFence && line.text.trim() === '') {
			flush();
			out.push(line);
		} else if (line.inFence) {
			flush();
			out.push(line);
		} else {
			block.push(line);
		}
	}
	flush();
	return out;
}

/**
 * Run a per-line transform outside fences while converting JSX comments
 * (single- and multi-line, brace-star to star-brace) into HTML comments.
 */
export function mdxCommentPass(annotated, transform) {
	let inJsxComment = false;
	return annotated.map((line) => {
		if (line.inFence) {
			return line;
		}
		if (inJsxComment) {
			if (line.text.includes('*/}')) {
				inJsxComment = false;
				return { ...line, text: line.text.replace(/\*\/\}/, '-->') };
			}
			return line;
		}
		let text = line.text.replace(/\{\/\*([\s\S]*?)\*\/\}/g, '<!--$1-->');
		text = transform(text);
		const openIdx = text.indexOf('{/*');
		if (openIdx !== -1 && !text.includes('*/}')) {
			inJsxComment = true;
			text = text.replace(/\{\/\*/, '<!--');
		}
		return { ...line, text };
	});
}

/**
 * Join a multi-line JSX open tag (`<TabItem\n  value="x">`) onto one line so
 * the single-line tag passes can see its attributes. Bounded so a stray `<`
 * can't swallow a page.
 */
export function mergeMultilineTags(annotated, names) {
	const startRe = new RegExp(`^\\s*<(?:${names.join('|')})\\b`);
	const out = [];
	for (let i = 0; i < annotated.length; i += 1) {
		const line = annotated[i];
		if (!line.inFence && startRe.test(line.text) && !line.text.includes('>')) {
			let text = line.text;
			let j = i;
			while (j + 1 < annotated.length && !text.includes('>') && j - i < 8) {
				j += 1;
				text += ` ${annotated[j].text.trim()}`;
			}
			out.push({ text, inFence: false });
			i = j;
		} else {
			out.push(line);
		}
	}
	return out;
}

function quoteItem(label) {
	return `'${label.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Convert `<Tabs><TabItem label="…">` (Docusaurus, Starlight) into the svocs
 * `<Tabs items={[…]}>` + positional `<Tab>` shape. Labels come from the item
 * tag's `label`, falling back to `value`, falling back to Tab N.
 */
export function convertJsxTabs(annotated, itemTag) {
	const openTabsRe = /^\s*<Tabs\b[^>]*>\s*$/;
	const closeTabsRe = /^\s*<\/Tabs>\s*$/;
	const itemOpenRe = new RegExp(`<${itemTag}\\b([^>]*)>`, 'g');
	const itemCloseRe = new RegExp(`</${itemTag}>`, 'g');
	const out = annotated.map((line) => ({ ...line }));

	for (let i = 0; i < out.length; i += 1) {
		if (out[i].inFence || !openTabsRe.test(out[i].text)) {
			continue;
		}
		let depth = 1;
		const items = [];
		for (let j = i + 1; j < out.length && depth > 0; j += 1) {
			const line = out[j];
			if (line.inFence) {
				continue;
			}
			if (openTabsRe.test(line.text)) {
				depth += 1;
				continue;
			}
			if (closeTabsRe.test(line.text)) {
				depth -= 1;
				continue;
			}
			if (depth !== 1) {
				continue;
			}
			line.text = line.text
				.replace(itemOpenRe, (full, attrs = '') => {
					const label =
						attrs.match(/label="([^"]*)"/)?.[1] ??
						attrs.match(/value="([^"]*)"/)?.[1] ??
						`Tab ${items.length + 1}`;
					items.push(label);
					return '<Tab>';
				})
				.replace(itemCloseRe, '</Tab>');
		}
		if (items.length > 0) {
			out[i].text = `<Tabs items={[${items.map(quoteItem).join(', ')}]}>`;
		}
	}
	return out;
}

/**
 * Convert `:::type[Title]` container directives (Docusaurus admonitions,
 * Starlight asides) into `<Callout>` blocks. Unknown types become `note`
 * with the raw type kept as a bold title so nothing is silently dropped.
 */
export function convertDirectives(annotated, typeMap) {
	const out = [];
	let open = 0;
	const padIfNeeded = () => {
		if (out.length > 0 && out[out.length - 1].text.trim() !== '') {
			out.push(blankLine());
		}
	};
	for (const line of annotated) {
		if (line.inFence) {
			out.push(line);
			continue;
		}
		if (open > 0 && /^\s*:{3,}\s*$/.test(line.text)) {
			padIfNeeded();
			out.push({ text: '</Callout>', inFence: false }, blankLine());
			open -= 1;
			continue;
		}
		const match = line.text.match(/^\s*:{3,}([A-Za-z][\w-]*)(?:\[([^\]]*)\])?\s*(.*)$/);
		if (match) {
			const mapped = typeMap[match[1].toLowerCase()];
			const title = (match[2] ?? match[3] ?? '').trim() || (mapped ? '' : match[1]);
			padIfNeeded();
			out.push({ text: `<Callout type="${mapped ?? 'note'}">`, inFence: false }, blankLine());
			if (title) {
				out.push({ text: `**${title}**`, inFence: false }, blankLine());
			}
			open += 1;
			continue;
		}
		out.push(line);
	}
	while (open > 0) {
		out.push(blankLine(), { text: '</Callout>', inFence: false });
		open -= 1;
	}
	return out;
}

// ---- links

/**
 * Source frameworks resolve relative links against the source file; rendered
 * routes resolve them against the URL, which differs on index pages.
 * Absolute /docs/ routes sidestep the mismatch entirely. `mapSegment` lets
 * adapters rewrite path segments (Docusaurus number prefixes, mdBook README).
 */
export function absolutizeLink(target, baseDir, mapSegment) {
	const [pathPart, hash = ''] = target.split(/(?=#)/);
	const cleaned = pathPart.replace(/\.(mdx?|svx)$/, '').replace(/\/$/, '');
	const segments = [];
	for (const part of `${baseDir}/${cleaned}`.split('/')) {
		if (part === '' || part === '.') {
			continue;
		}
		if (part === '..') {
			segments.pop();
		} else {
			segments.push(mapSegment ? mapSegment(part) : part);
		}
	}
	if (segments[segments.length - 1] === 'index') {
		segments.pop();
	}
	return `/docs${segments.length > 0 ? `/${segments.join('/')}` : ''}${hash}`;
}

/** Rewrite one line's internal links: absolutize relative, strip extensions. */
export function rewriteLinks(text, baseDir, mapSegment) {
	let out = text.replace(
		/\]\((?!https?:|mailto:|#|\/)([^)\s]+)\)/g,
		(full, target) => `](${absolutizeLink(target, baseDir, mapSegment)})`
	);
	out = out.replace(/\]\((\/[^)]*?)\.mdx?(#[^)]*)?\)/g, ']($1$2)');
	return out;
}

/**
 * For sources whose docs are served from the site root (Starlight, some
 * Nextra layouts): absolute internal links need the /docs prefix the
 * migrated routes live under.
 */
export function prefixDocsLinks(text) {
	return text
		.replace(
			/\]\((\/(?!docs(?:\/|\)|#))[^)#]*?)\/?(#[^)]*)?\)/g,
			(full, path, hash = '') => `](/docs${path === '/' ? '' : path}${hash ?? ''})`
		)
		.replace(
			/href="(\/(?!docs(?:\/|"|#))[^"#]*?)\/?(#[^"]*)?"/g,
			(full, path, hash = '') => `href="/docs${path === '/' ? '' : path}${hash ?? ''}"`
		);
}

/**
 * mdsvex doesn't parse markdown inside inline HTML, and a standalone
 * `<br />` opens an HTML block that swallows the next line's markdown.
 */
export function fixInlineHtml(text) {
	let out = text.replace(/<u>([^<]*)<\/u>/g, '$1');
	if (/^\s*<br\s*\/?>\s*$/.test(out)) {
		out = '';
	}
	return out;
}

// ---- assembly

/**
 * Emit the final page: frontmatter block, plus a `<script>` import preamble
 * when known components survive outside comments (making the page .svx).
 * Frontmatter values must already be YAML-safe.
 */
export function assemblePage(frontmatter, annotated) {
	let text = toText(annotated);
	// collapse the blank-line pileups left by removed lines
	text = text.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n');

	// commented-out blocks don't need imports
	const visibleText = text.replace(/<!--[\s\S]*?-->/g, '');
	const used = [...KNOWN_COMPONENTS].filter((name) =>
		new RegExp(`<${name}[\\s>/]`).test(visibleText)
	);

	const frontmatterLines = Object.entries(frontmatter)
		.filter(([, value]) => value !== undefined && value !== null && value !== '')
		.map(([key, value]) => `${key}: ${value}`);
	const frontmatterBlock =
		frontmatterLines.length > 0 ? `---\n${frontmatterLines.join('\n')}\n---\n\n` : '';

	if (used.length === 0) {
		return { ext: '.md', content: `${frontmatterBlock}${text.trimEnd()}\n` };
	}

	const imports = used
		.map((name) => `\timport ${name} from '$lib/components/${name}.svelte';`)
		.join('\n');
	return {
		ext: '.svx',
		content: `${frontmatterBlock}<script>\n${imports}\n</script>\n\n${text.trimEnd()}\n`
	};
}

// ---- filesystem helpers

/** Walk a tree, returning posix-relative paths for files `match` accepts. */
export function walkFiles(dir, match, prefix = '') {
	const files = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkFiles(full, match, rel));
		} else if (match(entry.name, rel)) {
			files.push({ rel, full });
		}
	}
	return files;
}

/** Merged dependencies from a package.json, or {} when unreadable. */
export function readDeps(sourceDir) {
	try {
		const pkg = JSON.parse(readFileSync(join(sourceDir, 'package.json'), 'utf8'));
		return { ...pkg.dependencies, ...pkg.devDependencies };
	} catch {
		return {};
	}
}

// ---- meta plumbing

/** Merge one item's config into `metaByDir` (Map<dir, itemsObject>). */
export function metaItem(metaByDir, dir, name, config) {
	if (!metaByDir.has(dir)) {
		metaByDir.set(dir, {});
	}
	const items = metaByDir.get(dir);
	items[name] = { ...items[name], ...config };
}
