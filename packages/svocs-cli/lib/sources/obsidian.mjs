// Obsidian (https://obsidian.md) vault -> svocs. Wikilinks resolve against
// the vault's own note index the way Obsidian resolves them (basename or
// vault path), image embeds are copied into static/attachments/, callouts
// become <Callout>, and vault-only machinery (Dataview, Templater, %%
// comments%%) is commented out or dropped. Notes with `publish: false` or
// `draft: true` are skipped.
//
// svocs can also read Obsidian syntax straight from content/ (the
// `obsidian()` preprocessor in vite.config.ts), so a one-off migration isn't
// required to keep writing in Obsidian — this converter is for vaults that
// want their notes turned into a plain-markdown svocs tree once.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import {
	annotateFences,
	assemblePage,
	blankLine,
	rewriteLinks,
	splitFrontmatter,
	toText,
	walkFiles,
	yamlValue
} from './pipeline.mjs';

const CALLOUT_TYPES = {
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
const ATTACHMENT_RE = /\.(png|jpe?g|gif|svg|webp|avif|pdf|mp4|webm|mp3|wav)$/i;

export function slugifySegment(segment) {
	return segment
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9.-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function slugifyRel(rel) {
	return rel
		.split('/')
		.map((segment, i, all) =>
			i === all.length - 1
				? `${slugifySegment(segment.replace(/\.md$/i, ''))}.md`
				: slugifySegment(segment)
		)
		.join('/');
}

function routeFor(rel) {
	const slugPath = slugifyRel(rel).replace(/\.md$/, '');
	const slug = slugPath === 'index' ? '' : slugPath.replace(/\/index$/, '');
	return slug ? `/docs/${slug}` : '/docs';
}

function headingAnchor(heading) {
	return `#${heading
		.trim()
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')}`;
}

function readJson(path) {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return null;
	}
}

/** Apply `fn` outside inline code spans. */
function outsideCode(line, fn) {
	return line
		.split(/(`+[^`]*`+)/)
		.map((part, i) => (i % 2 === 1 ? part : fn(part)))
		.join('');
}

function convertInline(text, state, todos) {
	let out = text.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');

	out = out.replace(/!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (full, target, param) => {
		const name = target.trim();
		if (IMAGE_RE.test(name)) {
			const url = state.attachments.get(basename(name).toLowerCase());
			if (!url) {
				todos.push(`attachment not found: ${name}`);
				return `<!-- svocs migrate TODO: attachment not found: ${name} -->`;
			}
			const alt = basename(name, extname(name));
			const width = param && /^\d+$/.test(param.trim()) ? param.trim() : null;
			return width ? `<img src="${url}" alt="${alt}" width="${width}" />` : `![${alt}](${url})`;
		}
		const route = state.resolveNote(name);
		if (!route) {
			todos.push(`embed target not found: ${name}`);
			return `<!-- svocs migrate TODO: embed target not found: ${name} -->`;
		}
		state.notes.push(`note embed ![[${name}]] became a link; svocs has no transclusion`);
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
			const route = state.resolveNote(name);
			if (!route) {
				todos.push(`wikilink target not found: ${name}`);
				return `${label}<!-- svocs migrate TODO: unresolved wikilink [[${name}]] -->`;
			}
			return `[${label}](${route}${anchor})`;
		}
	);

	// Templater / inline Dataview expressions can't run outside Obsidian
	out = out.replace(/<%[\s\S]*?%>/g, (full) => {
		todos.push('Templater expression');
		return `<!-- svocs migrate TODO: Templater: ${full.replace(/-->/g, '')} -->`;
	});

	return out;
}

function convertBody(body, state, todos) {
	const lines = body.split(/\r?\n/);
	const out = [];
	let inComment = false;

	for (let i = 0; i < lines.length; i += 1) {
		const annotated = annotateFences(lines.slice(0, i + 1));
		const current = annotated[annotated.length - 1];
		const line = lines[i];

		// Dataview blocks have no meaning outside the vault
		const dataview = line.match(/^\s*(```+|~~~+)\s*(dataview|dataviewjs)\s*$/);
		if (dataview) {
			const fence = dataview[1];
			const block = [line];
			while (i + 1 < lines.length && !lines[i + 1].trim().startsWith(fence)) {
				i += 1;
				block.push(lines[i]);
			}
			if (i + 1 < lines.length) {
				i += 1;
				block.push(lines[i]);
			}
			todos.push(`${dataview[2]} block`);
			out.push(`<!-- svocs migrate TODO: ${dataview[2]} block needs a static replacement`);
			out.push(...block.map((l) => l.replace(/-->/g, '-- >')));
			out.push('-->');
			continue;
		}

		if (current.inFence) {
			out.push(line);
			continue;
		}

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
		if (open !== -1) {
			text = text.slice(0, open);
			inComment = true;
		}

		if (text.trim() === '' && line.trim() !== '') {
			continue;
		}

		const callout = text.match(/^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)$/);
		if (callout) {
			const type = CALLOUT_TYPES[callout[1].toLowerCase()] ?? 'note';
			const title = callout[3].trim();
			const bodyLines = [];
			while (i + 1 < lines.length && /^>(\s|$)/.test(lines[i + 1])) {
				i += 1;
				bodyLines.push(
					outsideCode(lines[i].replace(/^>\s?/, ''), (part) => part.replace(/%%[^%]*?%%/g, ''))
				);
			}
			out.push(`<Callout type="${type}">`, '');
			if (title) {
				out.push(`**${convertInline(title, state, todos)}**`, '');
			}
			for (const bodyLine of bodyLines) {
				out.push(outsideCode(bodyLine, (part) => convertInline(part, state, todos)));
			}
			out.push('', '</Callout>');
			continue;
		}

		out.push(outsideCode(text, (part) => convertInline(part, state, todos)));
	}

	return out.join('\n');
}

export default {
	id: 'obsidian',
	label: 'Obsidian',
	homepage: 'https://obsidian.md',
	blurb:
		'Obsidian is where a lot of documentation is drafted before it has a home. This keeps the notes and drops the vault.',
	contentHint: 'no markdown notes were found in it',

	detect(sourceDir) {
		return existsSync(join(sourceDir, '.obsidian'));
	},

	contentDir(sourceDir) {
		return sourceDir;
	},

	extensions: ['.md'],

	skipFile(name, rel) {
		return rel.split('/').some((segment) => segment.startsWith('.'));
	},

	outRel(rel) {
		return slugifyRel(rel);
	},

	siteName(sourceDir) {
		return basename(sourceDir)
			.split(/[-_\s]+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	},

	async prepare({ sourceDir, contentDir, targetDir, notes }) {
		const appConfig = readJson(join(sourceDir, '.obsidian', 'app.json')) ?? {};
		const templatesConfig = readJson(join(sourceDir, '.obsidian', 'templates.json')) ?? {};
		const skipDirs = [templatesConfig.folder, appConfig.attachmentFolderPath]
			.filter((dir) => typeof dir === 'string' && dir && !dir.startsWith('.'))
			.map((dir) => dir.replace(/^\.?\//, '').replace(/\/$/, ''));

		const files = walkFiles(
			contentDir,
			(name, rel) => !rel.split('/').some((segment) => segment.startsWith('.'))
		);

		// note index: vault path and basename, lowercase, like Obsidian's resolver
		const byKey = new Map();
		for (const file of files) {
			if (!file.rel.endsWith('.md') || skipDirs.some((dir) => file.rel.startsWith(`${dir}/`))) {
				continue;
			}
			const route = routeFor(file.rel);
			const path = file.rel.replace(/\.md$/, '').toLowerCase();
			byKey.set(path, route);
			const name = path.split('/').pop();
			if (!byKey.has(name)) {
				byKey.set(name, route);
			}
		}

		// attachments: copied flat into static/attachments/, basename-keyed
		const attachments = new Map();
		let copied = 0;
		for (const file of files) {
			if (!ATTACHMENT_RE.test(file.rel)) {
				continue;
			}
			const name = basename(file.rel);
			if (attachments.has(name.toLowerCase())) {
				notes.push(`duplicate attachment name ${name}; only the first copy is used`);
				continue;
			}
			const dest = join(targetDir, 'static', 'attachments', name);
			mkdirSync(dirname(dest), { recursive: true });
			copyFileSync(file.full, dest);
			attachments.set(name.toLowerCase(), `/attachments/${name}`);
			copied += 1;
		}
		if (copied > 0) {
			notes.push(`copied ${copied} attachment(s) into static/attachments/`);
		}

		return {
			skipDirs,
			attachments,
			notes,
			resolveNote(target) {
				const key = target
					.trim()
					.replace(/^\.?\//, '')
					.replace(/\.md$/i, '')
					.toLowerCase();
				return byKey.get(key) ?? null;
			}
		};
	},

	convertPage(source, { rel, baseDir, todos, state }) {
		if (state.skipDirs?.some((dir) => rel.startsWith(`${dir}/`))) {
			return null;
		}
		const { frontmatter, fields, body } = splitFrontmatter(source);
		if (fields.publish === 'false' || fields.draft === 'true') {
			return null;
		}

		const title = frontmatter.title ?? basename(rel, '.md');
		let text = convertBody(body, state, todos);
		text = rewriteLinks(text, baseDir, slugifySegment);

		const annotated = annotateFences(text.split('\n'));
		const page = assemblePage(
			{
				title: yamlValue(title),
				description: frontmatter.description ? yamlValue(frontmatter.description) : undefined
			},
			annotated.length > 0 ? annotated : [blankLine()]
		);
		return { ext: page.ext, content: toText(annotateFences(page.content.split('\n'))) };
	},

	collectMeta() {
		return new Map();
	}
};
