// `svocs migrate` — convert an existing docs site (Fumadocs, Nextra,
// Docusaurus, Starlight, MkDocs, mdBook) into a new svocs site. Scaffolds a
// fresh site, then a per-framework adapter converts the content tree:
// frontmatter carries over, components map to their svocs equivalents, and
// anything site-specific is commented out with a TODO instead of breaking
// the build. The point is choice, not conquest: every supported source is
// good software, and the migration is meant to be reversible curiosity.
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
import { walkFiles } from './sources/pipeline.mjs';
import { detectSource, SOURCES } from './sources/index.mjs';

function prettifyName(name) {
	return name
		.split(/[-_.\s]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function packageName(sourceDir) {
	try {
		return JSON.parse(readFileSync(join(sourceDir, 'package.json'), 'utf8')).name;
	} catch {
		return null;
	}
}

export async function runMigrate(args) {
	const positional = args.filter((arg) => !arg.startsWith('-'));
	const flag = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

	const [sourceArg, targetArg] = positional;
	if (!sourceArg || !targetArg) {
		console.error(
			'Usage: svocs migrate <source-dir> <new-svocs-dir> [--source=<framework>] [--from=<pkg-dir>]'
		);
		console.error(`Supported source frameworks: ${SOURCES.map((s) => s.id).join(', ')}`);
		return 1;
	}
	const sourceDir = resolve(sourceArg);
	const targetDir = resolve(targetArg);

	p.intro(pc.bold('svocs migrate'));

	const forcedId = flag('source');
	const adapter = forcedId
		? SOURCES.find((source) => source.id === forcedId)
		: detectSource(sourceDir);
	if (forcedId && !adapter) {
		p.log.error(
			`Unknown --source "${forcedId}". Supported: ${SOURCES.map((s) => s.id).join(', ')}.`
		);
		p.outro('Nothing migrated.');
		return 1;
	}
	if (!adapter) {
		p.log.error(
			`${sourceDir} doesn't look like a site built with any framework this tool understands (${SOURCES.map((s) => s.label).join(', ')}). If it is one, force it with --source=<framework>; otherwise open an issue — the converter grows one source at a time.`
		);
		p.outro('Nothing migrated.');
		return 1;
	}

	const contentDir = adapter.contentDir(sourceDir);
	if (!contentDir) {
		p.log.error(`${sourceDir} looks like a ${adapter.label} site, but ${adapter.contentHint}.`);
		p.outro('Nothing migrated.');
		return 1;
	}
	if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
		p.log.error(`${targetDir} already exists and isn't empty.`);
		p.outro('Nothing migrated.');
		return 1;
	}

	p.log.info(`Source: a ${adapter.label} site (${adapter.homepage}).`);
	p.log.message(pc.dim(adapter.blurb));

	const siteName =
		flag('site-name') ??
		adapter.siteName?.(sourceDir) ??
		prettifyName(packageName(sourceDir) ?? basename(targetDir));

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
			packageName: basename(targetDir)
				.toLowerCase()
				.replace(/[^a-z0-9-~]+/g, '-'),
			accentColor: flag('accent') ?? '#ff3c00',
			searchBackend: flag('search') ?? 'pagefind',
			siteUrl: flag('site-url') ?? '',
			repoUrl: flag('repo-url') ?? '',
			repoBranch: flag('repo-branch') ?? ''
		};
		const s = p.spinner();
		s.start(`Scaffolding "${siteName}"`);
		scaffold(targetDir, options, {
			templateDir: join(packageDir, 'template'),
			recipesDir: join(packageDir, 'recipes', 'search')
		});
		writeManifest(targetDir, version, options);
		s.stop(`Scaffolded "${siteName}"`);

		// Migrated content can carry dead links from the source site (most
		// source frameworks never verified them); warn instead of failing.
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
		manifest.migratedFrom = adapter.id;
		manifest.files = Object.fromEntries(
			Object.entries(manifest.files).filter(([rel]) => !rel.startsWith('content/'))
		);
		writeFileSync(join(targetDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, '\t')}\n`);

		// ---- convert the content tree
		const notes = [];
		const state = (await adapter.prepare?.({ sourceDir, contentDir, notes })) ?? {};
		const extensions = adapter.extensions;
		const pages = walkFiles(
			contentDir,
			(name, rel) =>
				extensions.some((ext) => name.endsWith(ext)) && !(adapter.skipFile?.(name, rel) ?? false)
		);

		const todos = [];
		const routes = new Set(['/docs']);
		const linkRefs = [];
		let svxCount = 0;
		let hasRootIndex = false;

		const convertSpinner = p.spinner();
		convertSpinner.start(`Converting ${pages.length} page(s)`);
		for (const page of pages) {
			const fileTodos = [];
			const outRelSource = adapter.outRel ? adapter.outRel(page.rel) : page.rel;
			const baseDir =
				dirname(outRelSource) === '.' ? '' : dirname(outRelSource).replace(/\\/g, '/');
			const { ext, content } = adapter.convertPage(readFileSync(page.full, 'utf8'), {
				rel: page.rel,
				outRel: outRelSource,
				baseDir,
				todos: fileTodos,
				notes,
				state
			});
			if (fileTodos.length > 0) {
				todos.push({ rel: page.rel, count: fileTodos.length });
			}
			if (ext === '.svx') {
				svxCount += 1;
			}
			const slugPath = outRelSource.replace(
				new RegExp(`(${extensions.map((e) => e.replace('.', '\\.')).join('|')})$`),
				''
			);
			// same semantics as the template's toSlug()
			const slug = slugPath === 'index' ? '' : slugPath.replace(/\/index$/, '');
			routes.add(slug ? `/docs/${slug}` : '/docs');
			if (!slug) {
				hasRootIndex = true;
			}
			for (const match of content.matchAll(/\]\((\/docs[^)#?\s]*)/g)) {
				linkRefs.push({ target: match[1], from: page.rel });
			}
			const outRel = outRelSource.replace(
				new RegExp(`(${extensions.map((e) => e.replace('.', '\\.')).join('|')})$`),
				ext
			);
			const outPath = join(targetDir, 'content', outRel);
			mkdirSync(dirname(outPath), { recursive: true });
			writeFileSync(outPath, content);
		}
		for (const ref of linkRefs) {
			if (!routes.has(ref.target.replace(/\/$/, ''))) {
				notes.push(`dead link in ${ref.from}: ${ref.target} (carried over from the source site)`);
			}
		}

		// the /docs route needs a landing page; not every source has one
		if (!hasRootIndex) {
			writeFileSync(
				join(targetDir, 'content', 'index.md'),
				`---\ntitle: ${JSON.stringify(siteName)}\n---\n\nThis site was migrated from ${adapter.label} with \`svocs migrate\`. The source\nhad no page at its docs root, so this stub fills the /docs route — replace it\nwith your own introduction.\n`
			);
			notes.push(
				'the source had no root index page, so a stub content/index.md was generated for the /docs route.'
			);
		}

		// ---- sidebar ordering and titles
		const metaByDir =
			(await adapter.collectMeta?.({ sourceDir, contentDir, pages, notes, state })) ?? new Map();
		let metaCount = 0;
		for (const [dir, items] of metaByDir) {
			if (Object.keys(items).length === 0) {
				continue;
			}
			const outPath = join(targetDir, 'content', dir, '_meta.json');
			mkdirSync(dirname(outPath), { recursive: true });
			writeFileSync(outPath, `${JSON.stringify({ items }, null, '\t')}\n`);
			metaCount += 1;
		}
		convertSpinner.stop(
			`Converted ${pages.length} page(s): ${pages.length - svxCount} .md, ${svxCount} .svx${metaCount > 0 ? `, ${metaCount} _meta.json` : ''}`
		);

		for (const todo of todos) {
			p.log.warn(`TODO in ${todo.rel}: ${todo.count} block(s) flagged for manual porting`);
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
		p.outro(
			pc.bold('Done. ') +
				pc.dim(
					`If svocs isn't for you, your ${adapter.label} site is untouched — nothing was moved or deleted.`
				)
		);
		return 0;
	} finally {
		rmSync(tmpRoot, { recursive: true, force: true });
	}
}
