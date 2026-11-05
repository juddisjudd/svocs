// Fumadocs (https://fumadocs.dev/) -> svocs. Fumadocs and svocs share most
// component APIs (`Tabs` takes the same `items` prop, `Tab` is positional,
// `Callout` types map 1:1 apart from warn/error), so this is the most direct
// of the converters.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, posix } from 'node:path';
import {
	annotateFences,
	assemblePage,
	blankLine,
	commentUnportableBlocks,
	fixInlineHtml,
	includeTag,
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

function transformLine(text, links, state) {
	let out = fixInlineHtml(text);
	// fumadocs-only Tabs props svocs doesn't use
	out = out.replace(/(<Tabs\b[^>]*?)\s+groupId="[^"]*"/g, '$1');
	out = rewriteLinks(out, links);
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
		state.autoCardCount += 1;
	}
	return out;
}

/**
 * The other common auto-card shape, straight from Fumadocs' own docs
 * (no shorthand tag for it): a bare `<Cards>` wrapping a
 * `getPageTreePeers(source.getPageTree(), "…").map(peer => <Card …>)`
 * expression that lists the current section's siblings. Collapse the whole
 * block to `<Cards auto />` before `stripImports` runs, so the getPageTreePeers
 * and source identifiers it leaves behind are gone by the time the
 * unportable-block pass looks for them.
 */
function collapseAutoCardPeers(annotated, rel, notes) {
	const out = [];
	for (let i = 0; i < annotated.length; i += 1) {
		const line = annotated[i];
		if (!line.inFence && /^\s*<Cards>\s*$/.test(line.text)) {
			let j = i + 1;
			let peers = null;
			while (j < annotated.length && !/^\s*<\/Cards>\s*$/.test(annotated[j].text)) {
				if (annotated[j].inFence) {
					break;
				}
				if (annotated[j].text.includes('getPageTreePeers(')) {
					peers = annotated[j].text;
				}
				j += 1;
			}
			if (peers !== null && j < annotated.length) {
				const of = peers.match(/getPageTreePeers\([^,]+,\s*(["'`])(\/[^"'`]*)\1/)?.[2];
				const tag = of ? `<Cards of="${of.replace(/(.)\/$/, '$1')}" />` : '<Cards auto />';
				out.push({ text: tag, inFence: false });
				const filtered = peers.includes('.filter(')
					? ' The source filtered that list; svocs shows every page.'
					: '';
				notes.push(
					`${rel}: getPageTreePeers() Cards block converted to ${tag}.${filtered} Verify it lists what you expect.`
				);
				i = j;
				continue;
			}
		}
		out.push(line);
	}
	return out;
}

// Fumadocs inlines `<include>` targets at build time; a page include becomes an import of the migrated page.
function convertIncludes(text, dir, todos) {
	return text.replace(/<include(\s[^>]*)?>([^<]*)<\/include>/g, (tag, attrs, target) => {
		const path = target.trim();
		if (attrs?.trim() || !/\.mdx?$/.test(path)) {
			todos.push(tag);
			return `<!-- svocs migrate TODO: port this include by hand: ${tag} -->`;
		}
		return includeTag(posix.normalize(posix.join(dir, path)));
	});
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

/**
 * fumadocs meta.json -> ordered _meta entries as [dir, name, config], plus
 * the folder title/icon for the parent. Entries can land in a subfolder's
 * _meta: fumadocs lists nested paths (`guides/setup`) in a parent's pages,
 * while svocs keys each _meta.json by file names in its own folder.
 */
export function convertMeta(metaJson, notes, relDir) {
	const entries = [];
	const childDir = (dir, name) => (dir ? `${dir}/${name}` : name);
	const orderIn = new Map([[relDir, 1]]);
	const nextOrder = (dir) => {
		const order = orderIn.get(dir) ?? 1;
		orderIn.set(dir, order + 1);
		return order;
	};
	const placed = new Set();
	const notedFolders = new Set();
	let separators = 0;

	// `a/b/page` puts folder `a` at this position here, `b` inside `a`, and
	// the page last inside `a/b`, in listing order.
	const place = (path) => {
		const segments = path.split('/').filter(Boolean);
		let dir = relDir;
		for (const [i, segment] of segments.entries()) {
			const key = `${dir}\0${segment}`;
			if (!placed.has(key)) {
				placed.add(key);
				entries.push([dir, segment, { order: nextOrder(dir) }]);
			}
			if (i < segments.length - 1) {
				dir = childDir(dir, segment);
			}
		}
	};

	for (const entry of metaJson.pages ?? []) {
		if (entry === '...') {
			continue;
		}
		// `---Title---` (optionally `---[Icon]Title---`) is a sidebar separator
		const separator = entry.match(/^---(?:\[[^\]]*\])?(.*)---$/);
		if (separator) {
			separators += 1;
			entries.push([
				relDir,
				`separator-${separators}`,
				{ type: 'separator', title: separator[1].trim(), order: nextOrder(relDir) }
			]);
			continue;
		}
		if (/^\[.*\]\(.*\)$/.test(entry)) {
			notes.push(
				`${relDir || '.'}: sidebar link "${entry}" has no svocs equivalent; dropped. Link to it from a page instead.`
			);
			continue;
		}
		if (entry.startsWith('!')) {
			const segments = entry.slice(1).split('/').filter(Boolean);
			place(segments.join('/'));
			const dir = segments
				.slice(0, -1)
				.reduce((parent, segment) => childDir(parent, segment), relDir);
			const hiddenEntry = entries.find(([d, name]) => d === dir && name === segments.at(-1));
			if (hiddenEntry) {
				hiddenEntry[2].hidden = true;
			}
			continue;
		}
		const extract = entry.match(/^\.\.\.(.+)$/);
		if (extract) {
			notes.push(
				`${relDir || '.'}: "${entry}" inlined the pages of ${extract[1]}/ at this level in fumadocs; svocs shows ${extract[1]}/ as a folder group in that position instead.`
			);
			place(extract[1]);
			continue;
		}
		const folder = entry.includes('/') ? entry.slice(0, entry.lastIndexOf('/')) : null;
		if (folder && !notedFolders.has(folder)) {
			notedFolders.add(folder);
			notes.push(
				`${relDir || '.'}: pages of ${folder}/ are listed here in fumadocs; svocs groups them under ${folder}/, in the order listed.`
			);
		}
		place(entry);
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
	return { entries, title: metaJson.title, icon };
}

export default {
	id: 'fumadocs',
	label: 'Fumadocs',
	homepage: 'https://fumadocs.dev/',
	blurb:
		'Fumadocs is genuinely great software, and this converter is not an argument against it — it just makes trying a Svelte-based alternative cheap.',
	extensions: ['.mdx', '.md'],
	contentHint: 'no content/docs directory',
	publicDir: 'public',

	detect(sourceDir) {
		return Object.keys(readDeps(sourceDir)).some((name) => name.startsWith('fumadocs'));
	},

	contentDir(sourceDir) {
		const dir = join(sourceDir, 'content', 'docs');
		return existsSync(dir) ? dir : null;
	},

	prepare() {
		return { autoCardCount: 0 };
	},

	convertPage(source, { rel, links, todos, notes, state }) {
		const { frontmatter, fields, body } = splitFrontmatter(source);
		let annotated = annotateFences(body.split(/\r?\n/));

		// Runs first: collapses the raw getPageTreePeers() idiom to <Cards auto />
		// while its `source`/`getPageTreePeers` identifiers are still attached to
		// the block being removed, so stripImports never sees them used elsewhere.
		annotated = collapseAutoCardPeers(annotated, rel, notes);

		// DocsCategory is a known, mapped import (see transformLine) so it
		// doesn't fall into the unportable-block path before conversion runs.
		const stripped = stripImports(annotated, new Set(['DocsCategory']));
		annotated = stripped.lines;
		// Runs before any pass that reshapes lines, so an unportable JSX
		// expression is still one contiguous block and gets commented whole.
		annotated = commentUnportableBlocks(annotated, stripped.identifiers, todos);
		annotated = normalizeComponents(annotated);
		const includeDir = posix.dirname(rel) === '.' ? '' : posix.dirname(rel);
		annotated = mdxCommentPass(annotated, (text) => convertIncludes(text, includeDir, todos));
		const before = state.autoCardCount;
		annotated = mdxCommentPass(annotated, (text) => transformLine(text, links, state));
		if (state.autoCardCount > before) {
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
			const { entries, title, icon } = convertMeta(parsed, notes, relDir);
			for (const [dir, name, config] of entries) {
				metaItem(metaByDir, dir, name, config);
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
