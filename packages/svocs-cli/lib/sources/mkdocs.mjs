// MkDocs (https://www.mkdocs.org/) -> svocs. Pure-markdown source, so the
// work is structural: `!!! type` admonitions and `??? type` collapsibles
// become <Callout>/<Collapse>, pymdownx `=== "Tab"` content tabs become
// <Tabs>/<Tab>, the leading `# Title` hoists into frontmatter, and the
// mkdocs.yml `nav:` tree becomes _meta.json ordering.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
	annotateFences,
	assemblePage,
	hoistLeadingH1,
	mdxCommentPass,
	metaItem,
	rewriteLinks,
	splitFrontmatter,
	yamlValue
} from './pipeline.mjs';

const ADMONITION_TYPES = {
	note: 'note',
	seealso: 'note',
	quote: 'note',
	cite: 'note',
	abstract: 'note',
	summary: 'note',
	tldr: 'note',
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
	failure: 'danger',
	fail: 'danger',
	missing: 'danger',
	bug: 'danger'
};

const ADMONITION_RE = /^(!!!|\?\?\?\+?)\s+([\w-]+)((?:\s+[\w-]+)*)(?:\s+"((?:[^"\\]|\\.)*)")?\s*$/;
const TAB_RE = /^===\+?!?\s+"([^"]+)"\s*$/;

function escapeAttr(value) {
	return value.replace(/"/g, '&quot;');
}

/** Consume the 4-space-indented body that follows an opener at lines[start]. */
function consumeIndentedBody(lines, start) {
	const body = [];
	let i = start;
	while (i < lines.length) {
		const line = lines[i];
		if (line.trim() === '') {
			body.push('');
			i += 1;
			continue;
		}
		const dedented = line.replace(/^(\t| {4})/, '');
		if (dedented === line) {
			break;
		}
		body.push(dedented);
		i += 1;
	}
	// trailing blanks belong to the surrounding document
	while (body.length > 0 && body[body.length - 1] === '') {
		body.pop();
		i -= 1;
	}
	return { body, next: i };
}

/**
 * Recursive structural pass: admonitions and content tabs nest (an
 * admonition inside a tab is common in the wild), and each body is dedented
 * then re-processed. Fences are tracked at each level so literal `!!!` text
 * inside code samples is left alone.
 */
function convertBlocks(lines, todos) {
	const out = [];
	let i = 0;
	let inFence = false;
	while (i < lines.length) {
		const line = lines[i];
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			out.push(line);
			i += 1;
			continue;
		}
		if (inFence) {
			out.push(line);
			i += 1;
			continue;
		}
		// pymdownx snippets can't be resolved without running MkDocs
		if (/^-{2}8<-{2}/.test(line.trim())) {
			todos.push(line.trim().slice(0, 60));
			// double hyphens are invalid inside HTML comments
			out.push(
				`<!-- svocs migrate TODO: inline this MkDocs snippet manually: ${line.trim().replace(/--+/g, '·')} -->`
			);
			i += 1;
			continue;
		}
		const admonition = line.match(ADMONITION_RE);
		if (admonition && ADMONITION_TYPES[admonition[2].toLowerCase()]) {
			const { body, next } = consumeIndentedBody(lines, i + 1);
			const type = ADMONITION_TYPES[admonition[2].toLowerCase()];
			const title = (admonition[4] ?? '').replace(/\\(.)/g, '$1');
			const collapsible = admonition[1].startsWith('???');
			const inner = convertBlocks(body, todos);
			if (collapsible) {
				const label = title || admonition[2];
				out.push(
					`<Collapse title="${escapeAttr(label)}"${admonition[1] === '???+' ? ' open' : ''}>`,
					''
				);
				out.push(...inner);
				out.push('', '</Collapse>', '');
			} else {
				out.push(`<Callout type="${type}">`, '');
				if (title) {
					out.push(`**${title}**`, '');
				}
				out.push(...inner);
				out.push('', '</Callout>', '');
			}
			i = next;
			continue;
		}
		const tab = line.match(TAB_RE);
		if (tab) {
			const tabs = [];
			let j = i;
			while (j < lines.length) {
				const opener = lines[j].match(TAB_RE);
				if (!opener) {
					// blank lines may separate one tab's body from the next opener
					if (lines[j].trim() === '' && lines[j + 1]?.match(TAB_RE)) {
						j += 1;
						continue;
					}
					break;
				}
				const { body, next } = consumeIndentedBody(lines, j + 1);
				tabs.push({ label: opener[1], body: convertBlocks(body, todos) });
				j = next;
			}
			const items = tabs
				.map((t) => `'${t.label.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
				.join(', ');
			out.push(`<Tabs items={[${items}]}>`, '');
			for (const t of tabs) {
				out.push('<Tab>', '', ...t.body, '', '</Tab>', '');
			}
			out.push('</Tabs>', '');
			i = j;
			continue;
		}
		out.push(line);
		i += 1;
	}
	return out;
}

/**
 * Parse the `nav:` block of mkdocs.yml without a YAML dependency. Handles
 * the shapes real navs use — `- Title: path.md`, `- path.md`, and nested
 * sections — and gives up quietly on anything fancier.
 */
function parseNav(yml) {
	const lines = yml.split(/\r?\n/);
	const navIdx = lines.findIndex((line) => /^nav\s*:\s*$/.test(line));
	if (navIdx === -1) {
		return null;
	}
	const rows = [];
	for (let i = navIdx + 1; i < lines.length; i += 1) {
		const line = lines[i];
		if (line.trim() === '' || /^\s*#/.test(line)) {
			continue;
		}
		const indent = line.match(/^\s*/)[0].length;
		if (indent === 0) {
			break;
		}
		rows.push({ indent, text: line.trim() });
	}

	function parseLevel(start, indent) {
		const nodes = [];
		let i = start;
		while (i < rows.length && rows[i].indent === indent) {
			const row = rows[i];
			const match = row.text.match(/^-\s*(?:(?:"([^"]*)"|'([^']*)'|([^:]+?))\s*:)?\s*(.*)$/);
			if (!match) {
				i += 1;
				continue;
			}
			const title = (match[1] ?? match[2] ?? match[3])?.trim() ?? null;
			const value = match[4].trim();
			if (value) {
				nodes.push({ title, path: value });
				i += 1;
			} else if (i + 1 < rows.length && rows[i + 1].indent > indent) {
				const child = parseLevel(i + 1, rows[i + 1].indent);
				nodes.push({ title, children: child.nodes });
				i = child.next;
			} else {
				i += 1;
			}
		}
		return { nodes, next: i };
	}
	return parseLevel(0, rows[0]?.indent ?? 2).nodes;
}

function readYml(sourceDir) {
	for (const name of ['mkdocs.yml', 'mkdocs.yaml']) {
		const path = join(sourceDir, name);
		if (existsSync(path)) {
			return readFileSync(path, 'utf8');
		}
	}
	return null;
}

export default {
	id: 'mkdocs',
	label: 'MkDocs',
	homepage: 'https://www.mkdocs.org/',
	blurb:
		'MkDocs (and Material for MkDocs) has documented half the Python world for a decade — svocs is simply another option, not a verdict.',
	extensions: ['.md'],
	contentHint: 'no docs/ directory (or docs_dir in mkdocs.yml)',

	detect(sourceDir) {
		return readYml(sourceDir) !== null;
	},

	contentDir(sourceDir) {
		const yml = readYml(sourceDir);
		const configured = yml?.match(/^docs_dir:\s*['"]?([^'"\n]+?)['"]?\s*$/m)?.[1];
		const dir = join(sourceDir, configured ?? 'docs');
		return existsSync(dir) ? dir : null;
	},

	siteName(sourceDir) {
		return readYml(sourceDir)
			?.match(/^site_name:\s*['"]?([^'"\n]+?)['"]?\s*$/m)?.[1]
			?.trim();
	},

	convertPage(source, { baseDir, todos }) {
		const { frontmatter, body } = splitFrontmatter(source);
		let { title, body: rest } = { title: null, body };
		if (!frontmatter.title) {
			({ title, body: rest } = hoistLeadingH1(body));
		}

		const converted = convertBlocks(rest.split(/\r?\n/), todos);
		let annotated = annotateFences(converted);
		annotated = mdxCommentPass(annotated, (text) => rewriteLinks(text, baseDir));

		return assemblePage(
			{ ...frontmatter, ...(title ? { title: yamlValue(title) } : {}) },
			annotated
		);
	},

	collectMeta({ sourceDir, notes }) {
		const metaByDir = new Map();
		const nav = parseNav(readYml(sourceDir) ?? '');
		if (!nav) {
			return metaByDir;
		}
		const counters = new Map();
		const next = (dir) => {
			const n = (counters.get(dir) ?? 0) + 1;
			counters.set(dir, n);
			return n;
		};
		const collectPaths = (node) =>
			node.path ? [node.path] : (node.children ?? []).flatMap(collectPaths);

		/** Longest common directory of a section's page paths ('' when none). */
		const commonDir = (paths) => {
			const dirs = paths.map((p) => {
				const clean = p.replace(/\\/g, '/');
				return dirname(clean) === '.' ? '' : dirname(clean);
			});
			let prefix = dirs[0] ?? '';
			for (const dir of dirs) {
				while (prefix && dir !== prefix && !dir.startsWith(`${prefix}/`)) {
					prefix = dirname(prefix) === '.' ? '' : dirname(prefix);
				}
			}
			return prefix;
		};

		const visit = (node) => {
			if (node.path) {
				if (node.path.includes('://')) {
					return;
				}
				const slugRel = node.path.replace(/\\/g, '/').replace(/\.md$/, '');
				const dir = dirname(slugRel) === '.' ? '' : dirname(slugRel);
				metaItem(metaByDir, dir, basename(slugRel), {
					order: next(dir),
					...(node.title ? { title: node.title } : {})
				});
				return;
			}
			const paths = collectPaths(node).filter((p) => !p.includes('://'));
			const dir = commonDir(paths);
			if (node.title && dir) {
				const parent = dirname(dir) === '.' ? '' : dirname(dir);
				const existing = metaByDir.get(parent)?.[basename(dir)];
				if (!existing?.title) {
					metaItem(metaByDir, parent, basename(dir), {
						title: node.title,
						order: next(parent)
					});
				}
			} else if (node.title && paths.length > 0) {
				notes.push(
					`nav section "${node.title}" doesn't map onto a single directory; order those pages by hand in _meta.json if the sidebar looks wrong.`
				);
			}
			for (const child of node.children ?? []) {
				visit(child);
			}
		};
		for (const node of nav) {
			visit(node);
		}
		return metaByDir;
	}
};
