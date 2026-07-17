// mdBook (https://rust-lang.github.io/mdBook/) -> svocs. Nearly plain
// markdown: SUMMARY.md becomes _meta.json ordering (part headings become
// sidebar separators), README.md chapters become index pages the way mdBook
// itself serves them, rustdoc hidden lines (`# `) are stripped from rust
// fences, and `{{#include}}`-style preprocessor calls are flagged for a
// human since resolving them needs the mdBook build.
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

// mdbook-admonish fences map cleanly onto Callout
const ADMONISH_TYPES = {
	note: 'note',
	abstract: 'note',
	summary: 'note',
	tldr: 'note',
	quote: 'note',
	info: 'info',
	todo: 'info',
	question: 'info',
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

function bookToml(sourceDir) {
	const path = join(sourceDir, 'book.toml');
	return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function bookSection(toml) {
	return toml?.match(/^\[book\]([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1] ?? '';
}

function mapReadme(segment) {
	return segment === 'README' ? 'index' : segment;
}

/** SUMMARY.md -> ordered entries; `# Part` headings become separators. */
function parseSummary(text) {
	const entries = [];
	for (const line of text.split(/\r?\n/)) {
		// list-marker chapters plus bare prefix/suffix chapters like [Preface](./preface.md)
		const chapter = line.match(/^\s*(?:-|\*|\d+\.)?\s*\[([^\]]*)\]\(([^)]+)\)\s*$/);
		if (chapter) {
			entries.push({
				kind: 'chapter',
				title: chapter[1].trim(),
				rel: decodeURI(chapter[2].trim()).replace(/^\.\//, '').replace(/\\/g, '/')
			});
			continue;
		}
		const part = line.match(/^#+\s+(.+)$/);
		if (part && !/^summary$/i.test(part[1].trim())) {
			entries.push({ kind: 'part', title: part[1].trim() });
		}
	}
	return entries;
}

/**
 * Strip mdBook hidden lines (`# ` prefix) from rust fences and convert
 * mdbook-admonish fences into Callouts; count `{{#…}}` preprocessor calls.
 */
function convertFences(lines, todos) {
	const out = [];
	let fenceLang = null;
	for (const line of lines) {
		const edge = line.match(/^\s*(?:```|~~~)\s*(.*)$/);
		if (edge && fenceLang === null) {
			const info = edge[1].trim();
			const admonish = info.match(/^admonish(?:\s+([\w-]+))?(?:\s+"((?:[^"\\]|\\.)*)")?/);
			if (admonish) {
				fenceLang = 'admonish';
				const type = ADMONISH_TYPES[admonish[1]?.toLowerCase()] ?? 'note';
				out.push(`<Callout type="${type}">`, '');
				const title = (admonish[2] ?? '').replace(/\\(.)/g, '$1');
				if (title) {
					out.push(`**${title}**`, '');
				}
				continue;
			}
			fenceLang = info.split(/[\s,]/)[0] || 'rust';
			out.push(line);
			continue;
		}
		if (edge && fenceLang !== null) {
			if (fenceLang === 'admonish') {
				out.push('', '</Callout>', '');
			} else {
				out.push(line);
			}
			fenceLang = null;
			continue;
		}
		if (fenceLang === 'admonish') {
			out.push(line);
			continue;
		}
		if (fenceLang !== null) {
			// mdBook hides `# `-prefixed lines from readers; match its output
			if (/rust/.test(fenceLang) && /^\s*#(?: |$)(?!\[|!)/.test(line)) {
				continue;
			}
			if (/\{\{#(include|rustdoc_include|playground)\b/.test(line)) {
				todos.push(line.trim().slice(0, 60));
			}
			out.push(line);
			continue;
		}
		if (/\{\{#\w/.test(line)) {
			todos.push(line.trim().slice(0, 60));
			out.push(
				`<!-- svocs migrate TODO: resolve this mdBook preprocessor call manually: ${line.trim().replace(/--+/g, '·')} -->`
			);
			continue;
		}
		out.push(line);
	}
	return out;
}

export default {
	id: 'mdbook',
	label: 'mdBook',
	homepage: 'https://rust-lang.github.io/mdBook/',
	blurb:
		'mdBook is a Rust-community institution and does its job admirably — svocs just adds one more choice to the shelf.',
	extensions: ['.md'],
	contentHint: 'no src/ directory (or [book] src in book.toml)',

	detect(sourceDir) {
		return existsSync(join(sourceDir, 'book.toml'));
	},

	contentDir(sourceDir) {
		const configured = bookSection(bookToml(sourceDir)).match(/^\s*src\s*=\s*"([^"]+)"/m)?.[1];
		const dir = join(sourceDir, configured ?? 'src');
		return existsSync(dir) ? dir : null;
	},

	siteName(sourceDir) {
		return bookSection(bookToml(sourceDir)).match(/^\s*title\s*=\s*"([^"]+)"/m)?.[1];
	},

	skipFile(name) {
		return name === 'SUMMARY.md';
	},

	outRel(rel) {
		return rel.replace(/(^|\/)README\.md$/, '$1index.md');
	},

	prepare({ contentDir }) {
		const summaryPath = join(contentDir, 'SUMMARY.md');
		const summary = existsSync(summaryPath) ? parseSummary(readFileSync(summaryPath, 'utf8')) : [];
		const titles = new Map(
			summary.filter((e) => e.kind === 'chapter').map((e) => [e.rel, e.title])
		);
		return { summary, titles };
	},

	convertPage(source, { rel, baseDir, todos, state }) {
		const { frontmatter, body } = splitFrontmatter(source);
		let { title, body: rest } = { title: null, body };
		if (!frontmatter.title) {
			({ title, body: rest } = hoistLeadingH1(body));
			title = title ?? state.titles.get(rel) ?? null;
		}

		const converted = convertFences(rest.split(/\r?\n/), todos);
		let annotated = annotateFences(converted);
		annotated = mdxCommentPass(annotated, (text) =>
			rewriteLinks(text, baseDir, mapReadme).replace(/\]\((\/[^)]*?)\.md(#[^)]*)?\)/g, ']($1$2)')
		);

		return assemblePage(
			{ ...frontmatter, ...(title ? { title: yamlValue(title) } : {}) },
			annotated
		);
	},

	collectMeta({ state, notes }) {
		const metaByDir = new Map();
		const counters = new Map();
		const next = (dir) => {
			const n = (counters.get(dir) ?? 0) + 1;
			counters.set(dir, n);
			return n;
		};
		let separators = 0;
		const seenDirs = new Set(['']);

		/** Give ancestor folders a position the first time a chapter enters them. */
		const ensureDirOrder = (dir) => {
			if (seenDirs.has(dir)) {
				return;
			}
			const parent = dirname(dir) === '.' ? '' : dirname(dir);
			ensureDirOrder(parent);
			seenDirs.add(dir);
			if (metaByDir.get(parent)?.[basename(dir)]?.order === undefined) {
				metaItem(metaByDir, parent, basename(dir), { order: next(parent) });
			}
		};

		for (const entry of state.summary) {
			if (entry.kind === 'part') {
				separators += 1;
				metaItem(metaByDir, '', `separator-${separators}`, {
					type: 'separator',
					title: entry.title,
					order: next('')
				});
				continue;
			}
			const slugRel = entry.rel.replace(/\.md$/, '').split('/').map(mapReadme).join('/');
			const dir = dirname(slugRel) === '.' ? '' : dirname(slugRel);
			ensureDirOrder(dir);
			metaItem(metaByDir, dir, basename(slugRel), {
				order: next(dir),
				...(entry.title ? { title: entry.title } : {})
			});
			// a chapter that is its directory's index page also names the folder
			if (basename(slugRel) === 'index' && dir && entry.title) {
				const parent = dirname(dir) === '.' ? '' : dirname(dir);
				metaItem(metaByDir, parent, basename(dir), { title: entry.title });
			}
		}
		if (state.summary.length === 0) {
			notes.push('no SUMMARY.md found; sidebar ordering falls back to alphabetical.');
		}
		return metaByDir;
	}
};
