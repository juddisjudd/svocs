// Docusaurus (https://docusaurus.io/) -> svocs. The moving parts:
// `:::type` admonitions become <Callout>, <Tabs>/<TabItem> becomes the svocs
// items-prop shape, number-prefixed paths (01-intro.md) lose their prefixes
// like Docusaurus itself strips them, and sidebar_position/_category_.json
// become _meta.json ordering.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
	annotateFences,
	assemblePage,
	commentUnportableBlocks,
	convertDirectives,
	convertJsxTabs,
	fixInlineHtml,
	hoistLeadingH1,
	mdxCommentPass,
	mergeMultilineTags,
	metaItem,
	normalizeComponents,
	readDeps,
	rewriteLinks,
	splitFrontmatter,
	stripImports,
	walkFiles,
	yamlValue
} from './pipeline.mjs';

const MAPPED_IMPORTS = new Set(['Tabs', 'TabItem']);

const ADMONITION_TYPES = {
	note: 'note',
	tip: 'tip',
	info: 'info',
	warning: 'warning',
	caution: 'warning',
	danger: 'danger'
};

/** Docusaurus strips `01-` style prefixes from URLs; mirror that. */
function stripNumberPrefix(segment) {
	return segment.replace(/^\d+-/, '');
}

function stripPathPrefixes(rel) {
	return rel.split('/').map(stripNumberPrefix).join('/');
}

export default {
	id: 'docusaurus',
	label: 'Docusaurus',
	homepage: 'https://docusaurus.io/',
	blurb:
		'Docusaurus carries a huge share of the open-source ecosystem’s documentation, and it does it well — svocs is just another door.',
	extensions: ['.mdx', '.md'],
	contentHint: 'no docs/ directory',

	detect(sourceDir) {
		const deps = readDeps(sourceDir);
		return (
			'@docusaurus/core' in deps ||
			['docusaurus.config.js', 'docusaurus.config.ts', 'docusaurus.config.mjs'].some((name) =>
				existsSync(join(sourceDir, name))
			)
		);
	},

	contentDir(sourceDir) {
		const dir = join(sourceDir, 'docs');
		return existsSync(dir) ? dir : null;
	},

	skipFile(name) {
		// underscore-prefixed files are unrendered partials in Docusaurus
		return name.startsWith('_');
	},

	outRel(rel) {
		return stripPathPrefixes(rel);
	},

	prepare() {
		return { pageMeta: [] };
	},

	convertPage(source, { rel, outRel, baseDir, todos, notes, state }) {
		const { frontmatter, fields, body } = splitFrontmatter(source);
		let { title, body: rest } = { title: null, body };
		if (!frontmatter.title) {
			({ title, body: rest } = hoistLeadingH1(body));
		}
		if (fields.slug || fields.id) {
			notes.push(
				`${rel}: frontmatter ${fields.slug ? `slug (${fields.slug})` : `id (${fields.id})`} changed this page's URL on the old site; links to it may need fixing.`
			);
		}
		// sidebar ordering feeds collectMeta after the page loop
		const explicitOrder = fields.sidebar_position ? Number(fields.sidebar_position) : null;
		const prefixOrder = basename(rel).match(/^(\d+)-/)?.[1];
		state.pageMeta.push({
			rel,
			outRel,
			order: explicitOrder ?? (prefixOrder ? Number(prefixOrder) : null),
			title: fields.sidebar_label ?? null
		});

		let annotated = annotateFences(rest.split(/\r?\n/));
		annotated = mergeMultilineTags(annotated, ['Tabs', 'TabItem']);

		const stripped = stripImports(annotated, MAPPED_IMPORTS);
		annotated = stripped.lines;
		annotated = commentUnportableBlocks(annotated, stripped.identifiers, todos);
		annotated = convertJsxTabs(annotated, 'TabItem');
		annotated = normalizeComponents(annotated);
		annotated = convertDirectives(annotated, ADMONITION_TYPES);

		let customIds = 0;
		annotated = mdxCommentPass(annotated, (text) => {
			let out = text;
			const heading = out.match(/^(#{1,6}\s.*?)\s*\{#[\w-]+\}\s*$/);
			if (heading) {
				customIds += 1;
				out = heading[1];
			}
			out = fixInlineHtml(out);
			out = rewriteLinks(out, baseDir, stripNumberPrefix);
			return out;
		});
		if (customIds > 0) {
			notes.push(
				`${rel}: ${customIds} custom heading id(s) ({#…}) removed — svocs generates ids from heading text, so #anchors may differ.`
			);
		}

		return assemblePage(
			{ ...frontmatter, ...(title ? { title: yamlValue(title) } : {}) },
			annotated
		);
	},

	collectMeta({ contentDir, state }) {
		const metaByDir = new Map();

		// per-page sidebar_position / sidebar_label / number prefixes
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

		// folder labels/positions from _category_.json, plus dir number prefixes
		const categories = walkFiles(contentDir, (name) => name === '_category_.json');
		for (const category of categories) {
			const relDir = dirname(category.rel).replace(/\\/g, '/');
			if (relDir === '.') {
				continue;
			}
			let parsed;
			try {
				parsed = JSON.parse(readFileSync(category.full, 'utf8'));
			} catch {
				continue;
			}
			const strippedDir = stripPathPrefixes(relDir);
			const parent = dirname(strippedDir) === '.' ? '' : dirname(strippedDir);
			metaItem(metaByDir, parent, basename(strippedDir), {
				...(parsed.label ? { title: parsed.label } : {}),
				...(parsed.position !== undefined ? { order: parsed.position } : {})
			});
		}
		// number-prefixed directories (02-guides/) order themselves the same
		// way prefixed files do, unless _category_.json already set a position
		for (const page of state.pageMeta) {
			const rawDirs = page.rel.split('/').slice(0, -1);
			let parent = '';
			for (const rawSegment of rawDirs) {
				const segment = stripNumberPrefix(rawSegment);
				const prefix = rawSegment.match(/^(\d+)-/)?.[1];
				if (prefix && metaByDir.get(parent)?.[segment]?.order === undefined) {
					metaItem(metaByDir, parent, segment, { order: Number(prefix) });
				}
				parent = parent ? `${parent}/${segment}` : segment;
			}
		}
		return metaByDir;
	}
};
