// fumadocs -> svocs migration. Scaffolds a fresh svocs site, then converts
// the source's content/docs tree: frontmatter is carried over, fumadocs
// components are mapped to their svocs equivalents, and anything
// site-specific is commented out with a TODO instead of breaking the build.
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { fetchLatestPackage, MANIFEST_FILE, readManifest } from './shared.mjs';

// Components both frameworks ship with compatible APIs. Tabs takes the same
// `items` prop in both; Tab is positional in both; Steps wraps ### headings.
const KNOWN_COMPONENTS = new Set([
	'Callout',
	'Tabs',
	'Tab',
	'Steps',
	'Cards',
	'Card',
	'Collapse',
	'Banner',
	'Bleed',
	'FileTree'
]);

// ---- fence-aware line utilities

/** Split lines into { text, inFence } so transforms never touch code. */
function annotateFences(lines) {
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

// ---- individual transforms

function splitFrontmatter(source) {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) {
		return { frontmatter: {}, body: source };
	}
	const frontmatter = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kv = line.match(/^(title|description):\s*(.*)$/);
		if (kv) {
			frontmatter[kv[1]] = kv[2].trim();
		}
	}
	return { frontmatter, body: source.slice(match[0].length) };
}

/** Strip MDX preamble imports (outside fences); return their identifiers. */
function stripImports(annotated) {
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
			const cleaned = name.trim().split(/\s+as\s+/).pop();
			if (cleaned) {
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
function normalizeComponents(annotated) {
	const names = [...KNOWN_COMPONENTS].join('|');
	const openRe = new RegExp(`^(\\s*)<(${names})(\\s[^>]*)?>\\s*$`);
	const closeRe = new RegExp(`^(\\s*)</(${names})>\\s*$`);
	const blank = () => ({ text: '', inFence: false });
	const out = [];
	const dedents = [];

	const padIfNeeded = () => {
		if (out.length > 0 && out[out.length - 1].text.trim() !== '') {
			out.push(blank());
		}
	};

	for (const line of annotated) {
		if (!line.inFence && closeRe.test(line.text)) {
			padIfNeeded();
			out.push({ text: line.text.trim(), inFence: false });
			out.push(blank());
			dedents.pop();
			continue;
		}
		const open = line.inFence ? null : line.text.match(openRe);
		if (open) {
			padIfNeeded();
			out.push({ text: line.text.trim(), inFence: false });
			out.push(blank());
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

const CALLOUT_TYPE_MAP = { warn: 'warning', error: 'danger' };

/**
 * fumadocs resolves relative links against the source file's directory;
 * rendered routes resolve them against the URL, which differs on index
 * pages. Absolute /docs/ routes sidestep the mismatch entirely.
 */
function absolutizeLink(target, baseDir) {
	const [pathPart, hash = ''] = target.split(/(?=#)/);
	const cleaned = pathPart.replace(/\.mdx?$/, '');
	const segments = [];
	for (const part of `${baseDir}/${cleaned}`.split('/')) {
		if (part === '' || part === '.') {
			continue;
		}
		if (part === '..') {
			segments.pop();
		} else {
			segments.push(part);
		}
	}
	if (segments[segments.length - 1] === 'index') {
		segments.pop();
	}
	return `/docs${segments.length > 0 ? `/${segments.join('/')}` : ''}${hash}`;
}

function transformLine(text, baseDir) {
	// single-line JSX comments -> HTML comments
	let out = text.replace(/\{\/\*([\s\S]*?)\*\/\}/g, '<!--$1-->');
	// fumadocs-only Tabs props svocs doesn't use
	out = out.replace(/<Tabs\s+groupId="[^"]*"\s*/g, '<Tabs ');
	// mdsvex doesn't parse markdown inside inline HTML, so <u>**x**</u>
	// renders literal asterisks; drop the wrapper and keep the emphasis
	out = out.replace(/<u>([^<]*)<\/u>/g, '$1');
	// a standalone <br /> opens an HTML block that swallows the next line's
	// markdown; it's only ever used as spacing, which a blank line provides
	if (/^\s*<br\s*\/?>\s*$/.test(out)) {
		out = '';
	}
	// internal links: strip source-file extensions, absolutize relative paths
	out = out.replace(/\]\((?!https?:|mailto:|#|\/)([^)\s]+)\)/g, (full, target) =>
		`](${absolutizeLink(target, baseDir)})`
	);
	out = out.replace(/\]\((\/[^)]*?)\.mdx?(#[^)]*)?\)/g, ']($1$2)');
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
function wrapSteps(annotated) {
	const out = [];
	let openSteps = false;
	const closeRun = () => {
		if (openSteps) {
			out.push({ text: '', inFence: false }, { text: '</Steps>', inFence: false }, { text: '', inFence: false });
			openSteps = false;
		}
	};
	for (let line of annotated) {
		if (!line.inFence && /^#{1,6}\s.*\[step\]\s*$/.test(line.text)) {
			const isRunHeading = /^###\s/.test(line.text);
			line = { ...line, text: line.text.replace(/\s*\[step\]\s*$/, '') };
			if (isRunHeading && !openSteps) {
				out.push({ text: '<Steps>', inFence: false }, { text: '', inFence: false });
				openSteps = true;
			}
		} else if (!line.inFence && (/^#{1,2}\s/.test(line.text) || /^<\/?[A-Z]/i.test(line.text.trim()))) {
			closeRun();
		}
		out.push(line);
	}
	closeRun();
	return out;
}

// Raw-JSX constructs Svelte can't compile (style objects, JSX whitespace
// hacks, React attribute spellings).
const RAW_JSX_RE = /style=\{\{|\{" "\}|className=/;

/**
 * Comment out contiguous blocks (outside fences) that reference stripped
 * imports or contain raw JSX. The original block is preserved inside the
 * comment so porting it is copy-paste work.
 */
function commentUnportableBlocks(annotated, identifiers, todos) {
	const identifierRe =
		identifiers.size > 0
			? new RegExp(`[<{][\\s/]*(${[...identifiers].join('|')})\\b`)
			: null;
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
			out.push({ text: '<!-- svocs migrate TODO: port this site-specific block manually:', inFence: true });
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

function convertPage(source, todos, baseDir) {
	const { frontmatter, body } = splitFrontmatter(source);
	let annotated = annotateFences(body.split(/\r?\n/));

	const stripped = stripImports(annotated);
	annotated = stripped.lines;
	// Runs before any pass that reshapes lines, so an unportable JSX
	// expression is still one contiguous block and gets commented whole.
	annotated = commentUnportableBlocks(annotated, stripped.identifiers, todos);
	annotated = normalizeComponents(annotated);
	// multi-line JSX comments -> HTML comments (stateful across lines)
	let inJsxComment = false;
	annotated = annotated.map((line) => {
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
		let text = transformLine(line.text, baseDir);
		const openIdx = text.indexOf('{/*');
		if (openIdx !== -1 && !text.includes('*/}')) {
			inJsxComment = true;
			text = text.replace(/\{\/\*/, '<!--');
		}
		return { ...line, text };
	});
	annotated = wrapSteps(annotated);

	let text = annotated.map((l) => l.text).join('\n');
	// collapse the blank-line pileups left by removed imports
	text = text.replace(/^\n{2,}/, '').replace(/\n{3,}/g, '\n\n');

	// commented-out blocks don't need imports
	const visibleText = text.replace(/<!--[\s\S]*?-->/g, '');
	const used = [...KNOWN_COMPONENTS].filter((name) =>
		new RegExp(`<${name}[\\s>/]`).test(visibleText)
	);

	const frontmatterLines = Object.entries(frontmatter).map(([key, value]) => `${key}: ${value}`);
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

/** fumadocs meta.json -> svocs _meta.json (+ folder title for the parent). */
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

function walkMdx(dir, prefix = '') {
	const pages = [];
	const metas = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			const nested = walkMdx(full, rel);
			pages.push(...nested.pages);
			metas.push(...nested.metas);
		} else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
			pages.push({ rel, full });
		} else if (entry.name === 'meta.json') {
			metas.push({ rel, full });
		}
	}
	return { pages, metas };
}

function detectFumadocs(sourceDir) {
	try {
		const pkg = JSON.parse(readFileSync(join(sourceDir, 'package.json'), 'utf8'));
		const deps = { ...pkg.dependencies, ...pkg.devDependencies };
		return Object.keys(deps).some((name) => name.startsWith('fumadocs'));
	} catch {
		return false;
	}
}

function prettifyName(name) {
	return name
		.split(/[-_.\s]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export async function runMigrate(args) {
	const positional = args.filter((arg) => !arg.startsWith('-'));
	const flag = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

	const [sourceArg, targetArg] = positional;
	if (!sourceArg || !targetArg) {
		console.error('Usage: svocs migrate <fumadocs-dir> <new-svocs-dir> [--from=<pkg-dir>]');
		return 1;
	}
	const sourceDir = resolve(sourceArg);
	const targetDir = resolve(targetArg);

	p.intro(pc.bold('svocs migrate'));

	const docsDir = join(sourceDir, 'content', 'docs');
	if (!existsSync(docsDir)) {
		p.log.error(`${sourceDir} has no content/docs directory.`);
		p.outro('Nothing migrated.');
		return 1;
	}
	if (!detectFumadocs(sourceDir)) {
		p.log.error(
			`${sourceDir} doesn't look like a fumadocs project (no fumadocs-* dependency). Only fumadocs sources are supported right now.`
		);
		p.outro('Nothing migrated.');
		return 1;
	}
	if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
		p.log.error(`${targetDir} already exists and isn't empty.`);
		p.outro('Nothing migrated.');
		return 1;
	}

	const sourcePkgName = (() => {
		try {
			return JSON.parse(readFileSync(join(sourceDir, 'package.json'), 'utf8')).name;
		} catch {
			return null;
		}
	})();
	const siteName = flag('site-name') ?? prettifyName(sourcePkgName ?? basename(targetDir));

	// ---- scaffold the target from the template
	const tmpRoot = mkdtempSync(join(tmpdir(), 'svocs-migrate-'));
	try {
		const fromDir = flag('from');
		let packageDir;
		let version;
		if (fromDir) {
			packageDir = resolve(fromDir);
			version = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')).version;
			p.log.info(`Using local package at ${packageDir} (${version}).`);
		} else {
			const s = p.spinner();
			s.start('Fetching the latest create-svocs-docs from npm');
			({ dir: packageDir, version } = await fetchLatestPackage(tmpRoot));
			s.stop(`Fetched create-svocs-docs ${version}`);
		}

		const scaffoldModule = join(packageDir, 'lib', 'scaffold.mjs');
		if (!existsSync(scaffoldModule)) {
			p.log.error(`create-svocs-docs ${version} can't drive migrations (no lib/scaffold.mjs).`);
			p.outro('Nothing migrated.');
			return 1;
		}
		const { scaffold, writeManifest } = await import(pathToFileURL(scaffoldModule));

		const options = {
			siteName,
			packageName: basename(targetDir).toLowerCase().replace(/[^a-z0-9-~]+/g, '-'),
			accentColor: flag('accent') ?? '#ff3c00',
			searchBackend: flag('search') ?? 'pagefind',
			siteUrl: flag('site-url') ?? '',
			repoUrl: flag('repo-url') ?? ''
		};
		const s = p.spinner();
		s.start(`Scaffolding "${siteName}"`);
		scaffold(targetDir, options, {
			templateDir: join(packageDir, 'template'),
			recipesDir: join(packageDir, 'recipes', 'search')
		});
		writeManifest(targetDir, version, options);
		s.stop(`Scaffolded "${siteName}"`);

		// Migrated content can carry dead links from the source site (fumadocs
		// never verified them); warn instead of failing the whole build.
		const viteConfigPath = join(targetDir, 'vite.config.ts');
		writeFileSync(
			viteConfigPath,
			readFileSync(viteConfigPath, 'utf8').replace(
				/^(\s*)(adapter: adapter\([^)]*\),)$/m,
				`$1$2\n$1// Set by svocs migrate: the source site may contain dead internal\n$1// links and stale #anchors, which would otherwise fail prerendering.\n$1// Remove once the links reported by the migration are fixed.\n$1prerender: { handleHttpError: 'warn', handleMissingId: 'warn' },`
			)
		);

		// The starter content makes way for the converted tree. Mark the
		// manifest as migrated and drop content/ entries so `svocs update`
		// treats the whole tree as user-owned.
		rmSync(join(targetDir, 'content'), { recursive: true, force: true });
		const manifest = readManifest(targetDir);
		manifest.migrated = true;
		manifest.files = Object.fromEntries(
			Object.entries(manifest.files).filter(([rel]) => !rel.startsWith('content/'))
		);
		writeFileSync(join(targetDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, '\t')}\n`);

		// ---- convert the content tree
		const { pages, metas } = walkMdx(docsDir);
		const todos = [];
		const notes = [];
		const routes = new Set(['/docs']);
		const linkRefs = [];
		let svxCount = 0;

		const convertSpinner = p.spinner();
		convertSpinner.start(`Converting ${pages.length} page(s)`);
		for (const page of pages) {
			const fileTodos = [];
			const baseDir = dirname(page.rel) === '.' ? '' : dirname(page.rel).replace(/\\/g, '/');
			const { ext, content } = convertPage(readFileSync(page.full, 'utf8'), fileTodos, baseDir);
			if (fileTodos.length > 0) {
				todos.push({ rel: page.rel, count: fileTodos.length });
			}
			if (ext === '.svx') {
				svxCount += 1;
			}
			const slug = page.rel.replace(/\.mdx?$/, '').replace(/\/?index$/, '');
			routes.add(slug ? `/docs/${slug}` : '/docs');
			for (const match of content.matchAll(/\]\((\/docs[^)#?\s]*)/g)) {
				linkRefs.push({ target: match[1], from: page.rel });
			}
			const outRel = page.rel.replace(/\.mdx?$/, ext);
			const outPath = join(targetDir, 'content', outRel);
			mkdirSync(dirname(outPath), { recursive: true });
			writeFileSync(outPath, content);
		}
		for (const ref of linkRefs) {
			if (!routes.has(ref.target.replace(/\/$/, ''))) {
				notes.push(`dead link in ${ref.from}: ${ref.target} (carried over from the source site)`);
			}
		}

		// folder titles from meta.json land on the parent directory's _meta
		const parentTitles = new Map();
		for (const meta of metas) {
			const relDir = dirname(meta.rel) === '.' ? '' : dirname(meta.rel);
			const parsed = JSON.parse(readFileSync(meta.full, 'utf8'));
			const { items, title } = convertMeta(parsed, notes, relDir);
			if (Object.keys(items).length > 0) {
				const outPath = join(targetDir, 'content', relDir, '_meta.json');
				mkdirSync(dirname(outPath), { recursive: true });
				writeFileSync(outPath, `${JSON.stringify({ items }, null, '\t')}\n`);
			}
			if (title && relDir) {
				const parent = dirname(relDir) === '.' ? '' : dirname(relDir);
				if (!parentTitles.has(parent)) {
					parentTitles.set(parent, {});
				}
				parentTitles.get(parent)[basename(relDir)] = { title };
			}
		}
		for (const [parent, entries] of parentTitles) {
			const outPath = join(targetDir, 'content', parent, '_meta.json');
			const existing = existsSync(outPath)
				? JSON.parse(readFileSync(outPath, 'utf8'))
				: { items: {} };
			for (const [name, config] of Object.entries(entries)) {
				existing.items[name] = { ...existing.items[name], ...config };
			}
			mkdirSync(dirname(outPath), { recursive: true });
			writeFileSync(outPath, `${JSON.stringify(existing, null, '\t')}\n`);
		}
		convertSpinner.stop(
			`Converted ${pages.length} page(s): ${pages.length - svxCount} .md, ${svxCount} .svx`
		);

		for (const todo of todos) {
			p.log.warn(`TODO in ${todo.rel}: ${todo.count} block(s) commented out for manual porting`);
		}
		for (const note of notes) {
			p.log.info(note);
		}

		const nextSteps = [
			`cd ${targetArg}`,
			'bun install',
			'bun run dev',
			todos.length > 0 ? `search for "svocs migrate TODO" to port ${todos.length} page(s)` : null
		]
			.filter(Boolean)
			.map((step) => pc.cyan(step))
			.join('\n');
		p.note(nextSteps, 'Next steps');
		p.outro(pc.bold('Done.'));
		return 0;
	} finally {
		rmSync(tmpRoot, { recursive: true, force: true });
	}
}
