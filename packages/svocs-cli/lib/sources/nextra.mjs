// Nextra (https://nextra.site/) -> svocs. Nextra's authoring model is the
// closest of any source to svocs — `<Tabs items={…}>`, `<Steps>` over ###
// headings, `<Callout>` — so most components pass straight through; the work
// is the dotted names (Tabs.Tab, Cards.Card, FileTree.Folder) and _meta
// modules that may be JS/TS instead of JSON.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	annotateFences,
	assemblePage,
	commentUnportableBlocks,
	fixInlineHtml,
	hoistLeadingH1,
	mdxCommentPass,
	metaItem,
	normalizeComponents,
	prefixDocsLinks,
	readDeps,
	rewriteLinks,
	splitFrontmatter,
	stripImports,
	walkFiles,
	yamlValue
} from './pipeline.mjs';

// Names importable from nextra/components that this converter maps.
const MAPPED_IMPORTS = new Set([
	'Callout',
	'Tabs',
	'Tab',
	'Steps',
	'Cards',
	'Card',
	'FileTree',
	'Bleed',
	'Banner'
]);

const CALLOUT_TYPE_MAP = { default: 'info', error: 'danger' };

// v4 keeps content in content/ (or src/content/); v3 used pages/. Prefer a
// docs/ subtree when there is one so migrated routes match the source URLs.
const CONTENT_ROOTS = [
	'content/docs',
	'src/content/docs',
	'content',
	'src/content',
	'pages/docs',
	'src/pages/docs',
	'pages',
	'src/pages'
];

function chosenRoot(sourceDir) {
	return CONTENT_ROOTS.find((rel) => existsSync(join(sourceDir, rel))) ?? null;
}

function renameDottedComponents(text) {
	return text
		.replace(/<(\/?)Tabs\.Tab\b/g, '<$1Tab')
		.replace(/<(\/?)Cards\.Card\b/g, '<$1Card')
		.replace(/<(\/?)FileTree\.Folder\b/g, '<$1FileTreeFolder')
		.replace(/<(\/?)FileTree\.File\b/g, '<$1FileTreeFile');
}

function transformLine(text, baseDir, prefixAbsolute) {
	let out = fixInlineHtml(text);
	// keep only the items prop on <Tabs>; defaultIndex/storageKey are Nextra-only
	out = out.replace(/<Tabs\s+([^>]*)>/g, (full, attrs) => {
		const items = attrs.match(/items=\{.*\}/)?.[0];
		return items ? `<Tabs ${items}>` : '<Tabs>';
	});
	// Nextra-only Callout/Card props svocs has no use for
	out = out.replace(/\s+emoji=(?:"[^"]*"|\{[^}]*\})/g, '');
	out = out.replace(/\s+icon=\{[^}]*\}/g, '');
	out = out.replace(/(<Card\b[^>]*?)\s+arrow(?=[\s>])/g, '$1');
	out = out.replace(/(<FileTreeFolder\b[^>]*?)\s+defaultOpen(?=[\s>])/g, '$1 open');
	out = out.replace(/<Callout(\s[^>]*)?>/g, (tag, attrs = '') => {
		const typeMatch = attrs?.match(/type="([a-z]+)"/);
		if (!typeMatch) {
			return `<Callout type="info"${attrs ?? ''}>`;
		}
		const mapped = CALLOUT_TYPE_MAP[typeMatch[1]] ?? typeMatch[1];
		return tag.replace(/type="[a-z]+"/, `type="${mapped}"`);
	});
	out = rewriteLinks(out, baseDir);
	if (prefixAbsolute) {
		out = prefixDocsLinks(out);
	}
	return out;
}

/**
 * Best-effort parse of a `_meta.{js,jsx,ts,tsx}` module: extract the default
 * export's top-level keys in order, taking string values as titles. Anything
 * the scanner can't read (spreads, imports, JSX values) is skipped with a
 * note rather than guessed at.
 */
function parseMetaModule(text) {
	const objMatch = text.match(/export\s+default\s+\{([\s\S]*)\}/);
	if (!objMatch) {
		return null;
	}
	const body = objMatch[1];
	const chunks = [];
	let depth = 0;
	let quote = null;
	let current = '';
	for (let i = 0; i < body.length; i += 1) {
		const ch = body[i];
		if (quote) {
			current += ch;
			if (ch === quote && body[i - 1] !== '\\') {
				quote = null;
			}
			continue;
		}
		if (ch === '"' || ch === "'" || ch === '`') {
			quote = ch;
			current += ch;
			continue;
		}
		if ('{[('.includes(ch)) {
			depth += 1;
		} else if ('}])'.includes(ch)) {
			depth -= 1;
		}
		if (ch === ',' && depth === 0) {
			chunks.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	chunks.push(current);

	const entries = [];
	for (const chunk of chunks) {
		const entry = chunk
			.replace(/\/\/[^\n]*/g, '')
			.trim()
			.match(/^(?:"([^"]+)"|'([^']+)'|([\w-]+))\s*:\s*([\s\S]*)$/);
		if (!entry) {
			continue;
		}
		const key = entry[1] ?? entry[2] ?? entry[3];
		const value = entry[4].trim();
		const title = value.match(/^["'`]([^"'`]*)["'`]$/)?.[1] ?? null;
		const objectTitle = value.startsWith('{')
			? (value.match(/title\s*:\s*["'`]([^"'`]*)["'`]/)?.[1] ?? null)
			: null;
		const separator = /type\s*:\s*["'`]separator["'`]/.test(value);
		const hidden = /display\s*:\s*["'`]hidden["'`]/.test(value);
		entries.push({ key, title: title ?? objectTitle, separator, hidden });
	}
	return entries;
}

function parseMetaJson(text) {
	const parsed = JSON.parse(text);
	return Object.entries(parsed).map(([key, value]) => ({
		key,
		title:
			typeof value === 'string' ? value : typeof value?.title === 'string' ? value.title : null,
		separator: value?.type === 'separator',
		hidden: value?.display === 'hidden'
	}));
}

export default {
	id: 'nextra',
	label: 'Nextra',
	homepage: 'https://nextra.site/',
	blurb:
		'We are big fans of what the Nextra team builds — this converter exists so trying a Svelte option costs you an afternoon, not a rewrite.',
	extensions: ['.mdx', '.md'],
	contentHint: 'no content/, src/content/, or pages/ directory',

	detect(sourceDir) {
		return 'nextra' in readDeps(sourceDir);
	},

	contentDir(sourceDir) {
		const root = chosenRoot(sourceDir);
		return root ? join(sourceDir, root) : null;
	},

	skipFile(name) {
		// _meta.* and pages-router chrome (_app.mdx, _document.mdx)
		return name.startsWith('_');
	},

	prepare({ sourceDir }) {
		const root = chosenRoot(sourceDir) ?? '';
		// docs served from the site root need /docs prefixed onto absolute links
		return { prefixAbsolute: !root.endsWith('docs') };
	},

	convertPage(source, { baseDir, todos, state }) {
		const { frontmatter, body } = splitFrontmatter(source);
		let { title, body: rest } = { title: null, body };
		if (!frontmatter.title) {
			({ title, body: rest } = hoistLeadingH1(body));
		}
		let annotated = annotateFences(rest.split(/\r?\n/));
		annotated = annotated.map((line) =>
			line.inFence ? line : { ...line, text: renameDottedComponents(line.text) }
		);

		const stripped = stripImports(annotated, MAPPED_IMPORTS);
		annotated = stripped.lines;
		annotated = commentUnportableBlocks(annotated, stripped.identifiers, todos);
		annotated = normalizeComponents(annotated);
		annotated = mdxCommentPass(annotated, (text) =>
			transformLine(text, baseDir, state.prefixAbsolute)
		);

		return assemblePage(
			{ ...frontmatter, ...(title ? { title: yamlValue(title) } : {}) },
			annotated
		);
	},

	collectMeta({ contentDir, notes }) {
		const metaByDir = new Map();
		const metas = walkFiles(contentDir, (name) => /^_meta\.(json|jsx?|tsx?)$/.test(name));
		for (const meta of metas) {
			const relDir = dirname(meta.rel) === '.' ? '' : dirname(meta.rel).replace(/\\/g, '/');
			const text = readFileSync(meta.full, 'utf8');
			let entries;
			try {
				entries = meta.rel.endsWith('.json') ? parseMetaJson(text) : parseMetaModule(text);
			} catch {
				entries = null;
			}
			if (!entries) {
				notes.push(`${meta.rel}: couldn't read this _meta module; ordering not carried over.`);
				continue;
			}
			let order = 1;
			let separators = 0;
			for (const entry of entries) {
				if (entry.key === '*') {
					continue;
				}
				if (entry.separator) {
					separators += 1;
					metaItem(metaByDir, relDir, `separator-${separators}`, {
						type: 'separator',
						title: entry.title ?? '',
						order: order++
					});
					continue;
				}
				if (entry.hidden) {
					notes.push(
						`${meta.rel}: "${entry.key}" was hidden in the Nextra sidebar; svocs has no hidden pages, so it stays visible.`
					);
				}
				metaItem(metaByDir, relDir, entry.key, {
					order: order++,
					...(entry.title ? { title: entry.title } : {})
				});
			}
		}
		return metaByDir;
	}
};
