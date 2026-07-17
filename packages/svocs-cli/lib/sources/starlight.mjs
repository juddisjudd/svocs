// Starlight (https://starlight.astro.build/) -> svocs. Asides (`:::note`
// directives and <Aside>) become <Callout>, <Tabs>/<TabItem> becomes the
// items-prop shape, CardGrid/LinkCard map onto Cards/Card, and per-page
// `sidebar:` frontmatter becomes _meta.json ordering. Starlight serves docs
// from the site root, so absolute internal links gain the /docs prefix.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
	annotateFences,
	assemblePage,
	blankLine,
	commentUnportableBlocks,
	convertDirectives,
	convertJsxTabs,
	fixInlineHtml,
	mdxCommentPass,
	mergeMultilineTags,
	metaItem,
	normalizeComponents,
	prefixDocsLinks,
	readDeps,
	rewriteLinks,
	splitFrontmatter,
	stripImports
} from './pipeline.mjs';

const MAPPED_IMPORTS = new Set([
	'Tabs',
	'TabItem',
	'Card',
	'CardGrid',
	'LinkCard',
	'Steps',
	'Aside',
	'FileTree',
	'Badge'
]);

const ASIDE_TYPES = { note: 'note', tip: 'tip', caution: 'warning', danger: 'danger' };

// Starlight's icon set (~250-300 names via @astrojs/starlight/components'
// Icon) and svocs's curated 18 rarely share spelling even where the concept
// matches ("setting" not "gear", "seti:folder" not "folder"), so this only
// covers names confirmed against Starlight's own icon list rather than
// guessing at the rest — everything else is dropped with a note.
const STARLIGHT_ICON_MAP = {
	rocket: 'rocket',
	star: 'star',
	code: 'code',
	shield: 'shield',
	setting: 'gear',
	'seti:folder': 'folder',
	'seti:md': 'file'
};

function mapStarlightIcon(name) {
	return name ? (STARLIGHT_ICON_MAP[name.toLowerCase()] ?? null) : null;
}

/** `sidebar:` is a nested frontmatter key, so read it off the raw block. */
function sidebarFromRaw(raw) {
	const block = raw.match(/^sidebar:\s*\n((?:[ \t]+\S.*\n?)*)/m)?.[1];
	if (!block) {
		return {};
	}
	return {
		order: block.match(/^\s+order:\s*(\d+)/m)?.[1],
		label: block
			.match(/^\s+label:\s*(.+)$/m)?.[1]
			?.trim()
			.replace(/^["']|["']$/g, '')
	};
}

/** <Aside type="caution" title="Watch out"> -> Callout + bold title line. */
function convertAsides(annotated) {
	const out = [];
	const openTag = (attrs) => {
		const type = ASIDE_TYPES[attrs.match(/type="([a-z]+)"/)?.[1]] ?? 'note';
		const title = attrs.match(/title="([^"]*)"/)?.[1];
		return { type, title };
	};
	for (const line of annotated) {
		if (line.inFence) {
			out.push(line);
			continue;
		}
		const open = line.text.match(/^\s*<Aside\b([^>]*)>\s*$/);
		if (open) {
			const { type, title } = openTag(open[1]);
			out.push({ text: `<Callout type="${type}">`, inFence: false }, blankLine());
			if (title) {
				out.push({ text: `**${title}**`, inFence: false }, blankLine());
			}
			continue;
		}
		if (/^\s*<\/Aside>\s*$/.test(line.text)) {
			out.push(blankLine(), { text: '</Callout>', inFence: false });
			continue;
		}
		// inline form: <Aside type="…">content</Aside> on one line
		const text = line.text.replace(
			/<Aside\b([^>]*)>([\s\S]*?)<\/Aside>/g,
			(full, attrs, content) => {
				const { type, title } = openTag(attrs);
				// plain "Title:" — mdsvex doesn't parse markdown inside a
				// single-line component tag, so **bold** would render literally
				return `<Callout type="${type}">${title ? `${title}: ` : ''}${content}</Callout>`;
			}
		);
		out.push({ ...line, text });
	}
	return out;
}

/** Starlight-only components and props -> their svocs shapes. */
function renameComponents(text, iconStats) {
	let out = text.replace(/<(\/?)CardGrid\b[^>]*>/g, (full, close) =>
		close ? '</Cards>' : '<Cards>'
	);
	out = out.replace(/\s+icon="([^"]*)"/g, (full, name) => {
		const mapped = mapStarlightIcon(name);
		if (mapped) {
			iconStats.translated += 1;
			return ` icon="${mapped}"`;
		}
		iconStats.dropped += 1;
		return '';
	});
	// LinkCard is self-closing with a description attr; Card takes children
	out = out.replace(/<LinkCard\b([^>]*?)\/?>(?:<\/LinkCard>)?/g, (full, attrs) => {
		const title = attrs.match(/title="([^"]*)"/)?.[1] ?? '';
		const href = attrs.match(/href="([^"]*)"/)?.[1] ?? '';
		const description = attrs.match(/description="([^"]*)"/)?.[1] ?? '';
		return `<Card title="${title}"${href ? ` href="${href}"` : ''}>${description}</Card>`;
	});
	out = out.replace(/<Badge\b[^>]*\btext="([^"]*)"[^>]*\/?>(?:<\/Badge>)?/g, '**$1**');
	return out;
}

export default {
	id: 'starlight',
	label: 'Starlight',
	homepage: 'https://starlight.astro.build/',
	blurb:
		'Starlight is a lovely piece of the Astro ecosystem — if it fits you, keep it. This just makes a Svelte-based alternative easy to try.',
	extensions: ['.mdx', '.md'],
	contentHint: 'no src/content/docs directory',

	detect(sourceDir) {
		return '@astrojs/starlight' in readDeps(sourceDir);
	},

	contentDir(sourceDir) {
		const dir = join(sourceDir, 'src', 'content', 'docs');
		return existsSync(dir) ? dir : null;
	},

	prepare({ sourceDir, notes }) {
		for (const name of ['astro.config.mjs', 'astro.config.ts', 'astro.config.js']) {
			const path = join(sourceDir, name);
			if (existsSync(path) && /sidebar\s*:/.test(readFileSync(path, 'utf8'))) {
				notes.push(
					`sidebar groups configured in ${name} aren't carried over — set group titles and ordering in content/_meta.json files.`
				);
				break;
			}
		}
		return { pageMeta: [], strippedSteps: false, strippedFileTrees: false };
	},

	convertPage(source, { rel, outRel, baseDir, todos, notes, state }) {
		const { frontmatter, raw, body } = splitFrontmatter(source);
		const sidebar = sidebarFromRaw(raw);
		state.pageMeta.push({
			outRel,
			order: sidebar.order ? Number(sidebar.order) : null,
			title: sidebar.label ?? null
		});

		let annotated = annotateFences(body.split(/\r?\n/));
		annotated = mergeMultilineTags(annotated, [
			'Tabs',
			'TabItem',
			'Aside',
			'LinkCard',
			'Card',
			'CardGrid'
		]);

		// rename before normalizeComponents so Cards/Card regions get the
		// blank-line padding and dedenting known components receive
		const iconStats = { translated: 0, dropped: 0 };
		annotated = annotated.map((line) =>
			line.inFence ? line : { ...line, text: renameComponents(line.text, iconStats) }
		);
		if (iconStats.dropped > 0) {
			notes.push(
				`${rel}: ${iconStats.dropped} Starlight icon name(s) had no svocs equivalent in the curated set; dropped. See /docs/components#page-icons for the list.`
			);
		}

		const stripped = stripImports(annotated, MAPPED_IMPORTS);
		annotated = stripped.lines;
		annotated = commentUnportableBlocks(annotated, stripped.identifiers, todos);
		annotated = convertJsxTabs(annotated, 'TabItem');
		annotated = convertAsides(annotated);

		// Starlight's <Steps> numbers an ordered list; svocs Steps restyles ###
		// headings. Keep the list, drop the wrapper.
		const before = annotated.length;
		annotated = annotated.filter((line) => line.inFence || !/^\s*<\/?Steps>\s*$/.test(line.text));
		if (annotated.length !== before && !state.strippedSteps) {
			state.strippedSteps = true;
			notes.push(
				`${rel}: <Steps> wraps an ordered list in Starlight but ### headings in svocs — wrappers were removed, lists kept. Reintroduce <Steps> over headings where you want the numbered style.`
			);
		}

		// Starlight's <FileTree> wraps a plain nested list; keep the list.
		const beforeTrees = annotated.length;
		annotated = annotated.filter(
			(line) => line.inFence || !/^\s*<\/?FileTree>\s*$/.test(line.text)
		);
		if (annotated.length !== beforeTrees && !state.strippedFileTrees) {
			state.strippedFileTrees = true;
			notes.push(
				`${rel}: Starlight <FileTree> wrappers were removed (svocs FileTree uses explicit FileTreeFolder/FileTreeFile components); the nested lists remain.`
			);
		}

		annotated = normalizeComponents(annotated);
		annotated = convertDirectives(annotated, ASIDE_TYPES);
		annotated = mdxCommentPass(annotated, (text) => {
			let out = fixInlineHtml(text);
			out = rewriteLinks(out, baseDir);
			out = prefixDocsLinks(out);
			return out;
		});

		return assemblePage(
			{
				...(frontmatter.title ? { title: frontmatter.title } : {}),
				...(frontmatter.description ? { description: frontmatter.description } : {})
			},
			annotated
		);
	},

	collectMeta({ state }) {
		const metaByDir = new Map();
		for (const page of state.pageMeta) {
			if (page.order === null && page.title === null) {
				continue;
			}
			const slugRel = page.outRel.replace(/\.mdx?$/, '');
			const dir = dirname(slugRel) === '.' ? '' : dirname(slugRel);
			metaItem(metaByDir, dir, basename(slugRel), {
				...(page.order !== null ? { order: page.order } : {}),
				...(page.title ? { title: page.title } : {})
			});
		}
		return metaByDir;
	}
};
