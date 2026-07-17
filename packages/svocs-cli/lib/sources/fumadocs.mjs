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
	walkFiles
} from './pipeline.mjs';

const CALLOUT_TYPE_MAP = { warn: 'warning', error: 'danger' };

function transformLine(text, baseDir) {
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

/** fumadocs meta.json -> ordered _meta items (+ folder title for the parent). */
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
	return { items, title: metaJson.title };
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

	convertPage(source, { baseDir, todos }) {
		const { frontmatter, body } = splitFrontmatter(source);
		let annotated = annotateFences(body.split(/\r?\n/));

		const stripped = stripImports(annotated);
		annotated = stripped.lines;
		// Runs before any pass that reshapes lines, so an unportable JSX
		// expression is still one contiguous block and gets commented whole.
		annotated = commentUnportableBlocks(annotated, stripped.identifiers, todos);
		annotated = normalizeComponents(annotated);
		annotated = mdxCommentPass(annotated, (text) => transformLine(text, baseDir));
		annotated = wrapStepMarkers(annotated);

		return assemblePage(frontmatter, annotated);
	},

	collectMeta({ contentDir, notes }) {
		const metaByDir = new Map();
		const metas = walkFiles(contentDir, (name) => name === 'meta.json');
		for (const meta of metas) {
			const relDir = dirname(meta.rel) === '.' ? '' : dirname(meta.rel).replace(/\\/g, '/');
			const parsed = JSON.parse(readFileSync(meta.full, 'utf8'));
			const { items, title } = convertMeta(parsed, notes, relDir);
			for (const [name, config] of Object.entries(items)) {
				metaItem(metaByDir, relDir, name, config);
			}
			// the folder's own title lands on the parent directory's _meta
			if (title && relDir) {
				const parent = dirname(relDir) === '.' ? '' : dirname(relDir);
				metaItem(metaByDir, parent, basename(relDir), { title });
			}
		}
		return metaByDir;
	}
};
