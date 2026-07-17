// Fumadocs (https://fumadocs.dev/) -> svocs. Fumadocs and svocs share most
// component APIs (`Tabs` takes the same `items` prop, `Tab` is positional,
// `Callout` types map 1:1 apart from warn/error), so this is the most direct
// of the converters.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
	annotateFences,
	assemblePage,
	blankLine,
	commentUnportableBlocks,
	fixInlineHtml,
	mdxCommentPass,
	metaItem,
	normalizeComponents,
	readDeps,
	rewriteLinks,
	splitFrontmatter,
	stripImports,
	walkFiles,
	yamlValue
} from './pipeline.mjs';

const CALLOUT_TYPE_MAP = { warn: 'warning', error: 'danger' };

// Fumadocs' icon field is usually a lucide-react component name (resolved via
// its lucideIconsPlugin); svocs has its own small fixed set, so this is a
// best-effort translation, not a pass-through. Unmatched names are dropped
// with a note rather than left as a lucide name svocs can't resolve.
const LUCIDE_ICON_MAP = {
	rocket: 'rocket',
	book: 'book',
	bookopen: 'book',
	bookopentext: 'book',
	settings: 'gear',
	settings2: 'gear',
	cog: 'gear',
	terminal: 'terminal',
	terminalsquare: 'terminal',
	squareterminal: 'terminal',
	code: 'code',
	code2: 'code',
	codexml: 'code',
	folder: 'folder',
	folderopen: 'folder',
	folderclosed: 'folder',
	file: 'file',
	filetext: 'file',
	filecode: 'file',
	package: 'package',
	packageopen: 'package',
	packagecheck: 'package',
	zap: 'zap',
	zapoff: 'zap',
	shield: 'shield',
	shieldcheck: 'shield',
	shieldalert: 'shield',
	shieldhalf: 'shield',
	layers: 'layers',
	layers2: 'layers',
	layers3: 'layers',
	star: 'star',
	sparkle: 'star',
	sparkles: 'star',
	flag: 'flag',
	flagtriangleright: 'flag',
	key: 'key',
	keyround: 'key',
	keysquare: 'key',
	lock: 'lock',
	lockkeyhole: 'lock',
	lightbulb: 'lightbulb',
	lightbulboff: 'lightbulb',
	globe: 'globe',
	globe2: 'globe',
	target: 'target'
};

function mapIconName(name) {
	return name ? (LUCIDE_ICON_MAP[name.toLowerCase()] ?? null) : null;
}

function transformLine(text, baseDir, state) {
	let out = fixInlineHtml(text);
	// fumadocs-only Tabs props svocs doesn't use
	out = out.replace(/(<Tabs\b[^>]*?)\s+groupId="[^"]*"/g, '$1');
	out = rewriteLinks(out, baseDir);
	// fumadocs Callout types -> svocs Callout types
	out = out.replace(/<Callout(\s[^>]*)?>/g, (tag, attrs = '') => {
		const typeMatch = attrs?.match(/type="([a-z]+)"/);
		if (!typeMatch) {
			return `<Callout type="info"${attrs ?? ''}>`;
		}
		const mapped = CALLOUT_TYPE_MAP[typeMatch[1]] ?? typeMatch[1];
		return tag.replace(/type="[a-z]+"/, `type="${mapped}"`);
	});
	// Fumadocs apps commonly wire an auto-listing sibling-cards component as
	// <DocsCategory /> in their own theme (see packages/core's findSiblings
	// helper) — that's the one name confirmed by Fumadocs' own docs site, so
	// it's the only one matched; a differently-named equivalent falls through
	// to the unportable-block TODO path like any other unknown component.
	const before = out;
	out = out.replace(/<DocsCategory(\s[^>]*)?\/>/g, '<Cards auto />');
	if (out !== before) {
		state.docsCategoryCount += 1;
	}
	return out;
}

/**
 * Wrap runs of `### heading [step]` in <Steps>, stripping the marker (from
 * any heading depth — h4 substeps stay plain headings inside the run). A run
 * ends at the next h1/h2 heading, at any JSX tag boundary (so <Steps> never
 * crosses a </Tab>), or at end of file.
 */
function wrapStepMarkers(annotated) {
	const out = [];
	let openSteps = false;
	const closeRun = () => {
		if (openSteps) {
			out.push(blankLine(), { text: '</Steps>', inFence: false }, blankLine());
			openSteps = false;
		}
	};
	for (let line of annotated) {
		if (!line.inFence && /^#{1,6}\s.*\[step\]\s*$/.test(line.text)) {
			const isRunHeading = /^###\s/.test(line.text);
			line = { ...line, text: line.text.replace(/\s*\[step\]\s*$/, '') };
			if (isRunHeading && !openSteps) {
				out.push({ text: '<Steps>', inFence: false }, blankLine());
				openSteps = true;
			}
		} else if (
			!line.inFence &&
			(/^#{1,2}\s/.test(line.text) || /^<\/?[A-Z]/i.test(line.text.trim()))
		) {
			closeRun();
		}
		out.push(line);
	}
	closeRun();
	return out;
}

/** fumadocs meta.json -> ordered _meta items (+ folder title/icon for the parent). */
function convertMeta(metaJson, notes, relDir) {
	const items = {};
	let order = 1;
	for (const entry of metaJson.pages ?? []) {
		if (entry === '...') {
			continue;
		}
		if (entry.startsWith('!')) {
			notes.push(
				`${relDir || '.'}: "${entry}" hid "${entry.slice(1)}" from the fumadocs sidebar; svocs has no hidden pages, so it stays visible.`
			);
			continue;
		}
		items[entry] = { order: order++ };
	}
	let icon;
	if (metaJson.icon) {
		icon = mapIconName(metaJson.icon);
		if (!icon) {
			notes.push(
				`${relDir || '.'}: meta.json icon "${metaJson.icon}" has no svocs equivalent in the curated set; dropped. Pick one by hand in _meta.json if you want an icon there.`
			);
		}
	}
	return { items, title: metaJson.title, icon };
}

export default {
	id: 'fumadocs',
	label: 'Fumadocs',
	homepage: 'https://fumadocs.dev/',
	blurb:
		'Fumadocs is genuinely great software, and this converter is not an argument against it — it just makes trying a Svelte-based alternative cheap.',
	extensions: ['.mdx', '.md'],
	contentHint: 'no content/docs directory',

	detect(sourceDir) {
		return Object.keys(readDeps(sourceDir)).some((name) => name.startsWith('fumadocs'));
	},

	contentDir(sourceDir) {
		const dir = join(sourceDir, 'content', 'docs');
		return existsSync(dir) ? dir : null;
	},

	prepare() {
		return { docsCategoryCount: 0 };
	},

	convertPage(source, { rel, baseDir, todos, notes, state }) {
		const { frontmatter, fields, body } = splitFrontmatter(source);
		let annotated = annotateFences(body.split(/\r?\n/));

		// DocsCategory is a known, mapped import (see transformLine) so it
		// doesn't fall into the unportable-block path before conversion runs.
		const stripped = stripImports(annotated, new Set(['DocsCategory']));
		annotated = stripped.lines;
		// Runs before any pass that reshapes lines, so an unportable JSX
		// expression is still one contiguous block and gets commented whole.
		annotated = commentUnportableBlocks(annotated, stripped.identifiers, todos);
		annotated = normalizeComponents(annotated);
		const before = state.docsCategoryCount;
		annotated = mdxCommentPass(annotated, (text) => transformLine(text, baseDir, state));
		if (state.docsCategoryCount > before) {
			notes.push(
				`${rel}: <DocsCategory /> converted to <Cards auto /> — verify it lists what you expect.`
			);
		}
		annotated = wrapStepMarkers(annotated);

		const icon = fields.icon ? mapIconName(fields.icon) : undefined;
		if (fields.icon && !icon) {
			notes.push(
				`${rel}: frontmatter icon "${fields.icon}" has no svocs equivalent in the curated set; dropped. See /docs/components#page-icons for the list.`
			);
		}

		return assemblePage({ ...frontmatter, ...(icon ? { icon: yamlValue(icon) } : {}) }, annotated);
	},

	collectMeta({ contentDir, notes }) {
		const metaByDir = new Map();
		const metas = walkFiles(contentDir, (name) => name === 'meta.json');
		for (const meta of metas) {
			const relDir = dirname(meta.rel) === '.' ? '' : dirname(meta.rel).replace(/\\/g, '/');
			const parsed = JSON.parse(readFileSync(meta.full, 'utf8'));
			const { items, title, icon } = convertMeta(parsed, notes, relDir);
			for (const [name, config] of Object.entries(items)) {
				metaItem(metaByDir, relDir, name, config);
			}
			// the folder's own title/icon lands on the parent directory's _meta
			if ((title || icon) && relDir) {
				const parent = dirname(relDir) === '.' ? '' : dirname(relDir);
				metaItem(metaByDir, parent, basename(relDir), {
					...(title ? { title } : {}),
					...(icon ? { icon } : {})
				});
			}
		}
		return metaByDir;
	}
};
