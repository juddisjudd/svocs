// `svocs sync` — refresh content that mirrors something outside content/:
//
//   1. Pages with a `source:` (frontmatter or sidecar .meta.json) get their
//      body replaced with that file — a README, CHANGELOG, a GitHub blob URL.
//   2. Sites scaffolded from repo analysis re-run it with the recorded
//      options, rewriting generated pages you haven't edited since.
//
// Edited files are never overwritten: generated pages are hash-checked
// against the manifest, and `source:` pages are rebuilt wholesale by design
// (their body is the mirror; edits belong upstream).
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
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
	fetchLatestPackage,
	hashFile,
	looksLikeSvocsSite,
	MANIFEST_FILE,
	readManifest
} from './shared.mjs';

const LLM_ENV_VAR = {
	anthropic: 'ANTHROPIC_API_KEY',
	openai: 'OPENAI_API_KEY',
	openrouter: 'OPENROUTER_API_KEY'
};

function walk(dir, out = [], prefix = '') {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			walk(join(dir, entry.name), out, rel);
		} else {
			out.push(rel);
		}
	}
	return out;
}

function splitFrontmatter(source) {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) {
		return { block: '', fields: {}, body: source };
	}
	const fields = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
		if (kv) {
			fields[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
		}
	}
	return { block: match[0], fields, body: source.slice(match[0].length) };
}

function readSidecar(dir, rel) {
	const path = join(dir, rel.replace(/\.(md|svx)$/, '.meta.json'));
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return {};
	}
}

// ---- `source:` pages

const GITHUB_BLOB = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/;

async function fetchSource(source, siteDir) {
	if (/^https?:\/\//.test(source)) {
		const blob = source.match(GITHUB_BLOB);
		const url = blob
			? `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}/${blob[4]}`
			: source;
		const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
		if (!response.ok) {
			throw new Error(`${url} responded ${response.status}`);
		}
		const linkBase = blob
			? `https://github.com/${blob[1]}/${blob[2]}/blob/${blob[3]}/${dirname(blob[4]) === '.' ? '' : `${dirname(blob[4])}/`}`
			: new URL('.', url).href;
		return { text: await response.text(), linkBase };
	}
	const path = isAbsolute(source) ? source : resolve(siteDir, source);
	if (!existsSync(path)) {
		throw new Error(`${path} does not exist`);
	}
	return { text: readFileSync(path, 'utf8'), linkBase: null };
}

/** Upstream markdown → page body: no frontmatter, no duplicate H1, links that still work. */
export function prepareSourceBody(text, { hasTitle, linkBase, source }) {
	let body = splitFrontmatter(text).body;
	if (hasTitle) {
		body = body.replace(/^\s*#\s+[^\n]*\n+/, '');
	}
	if (linkBase) {
		body = body.replace(
			/(!?\[[^\]]*\]\()(?!https?:|mailto:|#|\/)([^)\s]+)(\))/g,
			(full, open, target, close) => {
				const absolute = `${linkBase}${target.replace(/^\.\//, '')}`;
				// images must point at the raw file, not the GitHub page
				return `${open}${open.startsWith('!') ? absolute.replace('/blob/', '/raw/') : absolute}${close}`;
			}
		);
	}
	return `<!-- synced from ${source} by \`svocs sync\`; edit the source, not this file -->\n\n${body.trim()}\n`;
}

async function planSourcePages(dir, notes) {
	const contentDir = join(dir, 'content');
	const changes = [];
	for (const rel of walk(contentDir)) {
		if (!/\.(md|svx)$/.test(rel) || /(^|\/)_meta\.(md|svx)$/.test(rel)) {
			continue;
		}
		const file = join(contentDir, rel);
		const current = readFileSync(file, 'utf8');
		const { block, fields } = splitFrontmatter(current);
		const sidecar = readSidecar(contentDir, rel);
		const source = fields.source ?? sidecar.source;
		if (!source) {
			continue;
		}
		try {
			const { text, linkBase } = await fetchSource(source, dir);
			const next =
				block +
				prepareSourceBody(text, {
					hasTitle: Boolean(fields.title ?? sidecar.title),
					linkBase,
					source
				});
			if (next !== current) {
				changes.push({ rel: `content/${rel}`, action: 'update', content: next });
			}
		} catch (error) {
			notes.push(`content/${rel}: couldn't fetch ${source} (${error.message})`);
		}
	}
	return changes;
}

// ---- repo analysis regeneration

async function regeneratePages(analysis, packageDir, notes, onProgress) {
	const lib = await import(pathToFileURL(join(packageDir, 'lib', 'repo-analysis.mjs')));
	const parsed = lib.parseGithubRepo(analysis.repo);
	if (!parsed) {
		notes.push(`repo analysis: can't parse recorded repo "${analysis.repo}"`);
		return null;
	}
	let context = await lib.fetchRepoContext(parsed.owner, parsed.repo);
	if (!context || context.error) {
		notes.push(`repo analysis: fetching ${analysis.repo} failed (${context?.error ?? 'unknown'})`);
		return null;
	}

	if (analysis.mode === 'llm') {
		const apiKey = process.env[LLM_ENV_VAR[analysis.provider] ?? ''] ?? '';
		if (!apiKey) {
			notes.push(
				`repo analysis: ${LLM_ENV_VAR[analysis.provider] ?? 'the provider key'} isn't set, so the LLM-generated pages were left alone (heuristic output would be a downgrade).`
			);
			return null;
		}
		const material = await lib.gatherScanMaterial(
			parsed.owner,
			parsed.repo,
			context,
			analysis.scanDepth ?? 'standard',
			(message) => notes.push(`repo analysis: ${message}`)
		);
		context = { ...context, ...material };
		return lib.generateLlmPages(
			context,
			analysis.provider,
			apiKey,
			analysis.model,
			analysis.scanDepth ?? 'standard',
			(message) => notes.push(`repo analysis: ${message}`),
			onProgress
		);
	}
	return lib.generateHeuristicPages(context);
}

function planGeneratedPages(dir, manifest, pages, packageDir, tmpRoot) {
	const lib = join(packageDir, 'lib', 'repo-analysis.mjs');
	const stage = join(tmpRoot, 'stage');
	mkdirSync(join(stage, 'content'), { recursive: true });
	writeFileSync(join(stage, 'content', '_meta.json'), '{\n\t"items": {}\n}\n');
	return import(pathToFileURL(lib)).then(({ writeGeneratedPages }) => {
		writeGeneratedPages(stage, pages);
		const recorded = manifest.repoAnalysis.files ?? {};
		const changes = [];
		const newSlugs = [];
		for (const rel of walk(join(stage, 'content'))) {
			if (rel === '_meta.json') {
				continue;
			}
			const key = `content/${rel}`;
			const content = readFileSync(join(stage, 'content', rel), 'utf8');
			const local = join(dir, key);
			if (!existsSync(local)) {
				changes.push({ rel: key, action: 'add', content });
				if (rel.endsWith('.md')) {
					newSlugs.push(rel.replace(/\.md$/, ''));
				}
			} else if (readFileSync(local, 'utf8') === content) {
				changes.push({ rel: key, action: 'unchanged', content });
			} else if (hashFile(local) === recorded[key]) {
				changes.push({ rel: key, action: 'update', content });
			} else {
				changes.push({ rel: key, action: 'skip' });
			}
		}

		// new pages join the sidebar after everything that's already ordered
		if (newSlugs.length > 0) {
			const metaPath = join(dir, 'content', '_meta.json');
			const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
			const items = meta.items ?? {};
			let order = Math.max(0, ...Object.values(items).map((item) => item.order ?? 0));
			for (const slug of newSlugs) {
				if (!(slug in items)) {
					order += 1;
					items[slug] = { order };
				}
			}
			changes.push({
				rel: 'content/_meta.json',
				action: 'update',
				content: `${JSON.stringify({ ...meta, items }, null, '\t')}\n`
			});
		}
		return changes;
	});
}

// ---- command

export async function runSync(args) {
	const dir = resolve(args.find((arg) => !arg.startsWith('-')) ?? '.');
	const dryRun = args.includes('--dry-run');
	const yes = args.includes('--yes');
	const skipRepo = args.includes('--skip-repo');
	const skipSources = args.includes('--skip-sources');
	const fromDir = args.find((arg) => arg.startsWith('--from='))?.slice('--from='.length);

	p.intro(pc.bold('svocs sync'));

	if (!looksLikeSvocsSite(dir)) {
		p.log.error(`${dir} doesn't look like a SVOCS site (no src/lib/site.ts + content/).`);
		p.outro('Nothing synced.');
		return 1;
	}

	const notes = [];
	let changes = [];
	const manifest = readManifest(dir);

	if (!skipSources) {
		const s = p.spinner();
		s.start('Refreshing pages with a source:');
		const sourceChanges = await planSourcePages(dir, notes);
		s.stop(
			sourceChanges.length > 0
				? `${sourceChanges.length} source-backed page(s) changed upstream`
				: 'Source-backed pages are current'
		);
		changes.push(...sourceChanges);
	}

	const tmpRoot = mkdtempSync(join(tmpdir(), 'svocs-sync-'));
	try {
		if (!skipRepo && manifest?.repoAnalysis) {
			let packageDir;
			if (fromDir) {
				packageDir = resolve(fromDir);
			} else {
				const s = p.spinner();
				s.start('Fetching create-svocs-docs (repo analysis lives there)');
				({ dir: packageDir } = await fetchLatestPackage(tmpRoot));
				s.stop('Fetched create-svocs-docs');
			}
			const s = p.spinner();
			s.start(`Re-analyzing ${manifest.repoAnalysis.repo} (${manifest.repoAnalysis.mode})`);
			const pages = await regeneratePages(manifest.repoAnalysis, packageDir, notes, (message) =>
				s.message(message)
			);
			if (!pages || pages.length === 0) {
				s.stop('Repo analysis produced nothing new');
			} else {
				s.stop(`Repo analysis produced ${pages.length} page(s)`);
				changes.push(...(await planGeneratedPages(dir, manifest, pages, packageDir, tmpRoot)));
			}
		} else if (!skipRepo && manifest && !manifest.repoAnalysis) {
			p.log.info('No repo analysis recorded for this site; only source: pages are synced.');
		}

		for (const note of notes) {
			p.log.warn(note);
		}

		const writes = changes.filter((c) => c.action === 'add' || c.action === 'update');
		for (const change of changes) {
			if (change.action === 'add') p.log.info(`${pc.green('add')}     ${change.rel}`);
			if (change.action === 'update') p.log.info(`${pc.cyan('update')}  ${change.rel}`);
			if (change.action === 'skip')
				p.log.warn(`${pc.yellow('skip')}    ${change.rel} (you edited it)`);
		}

		if (writes.length === 0) {
			p.outro(pc.green('Everything is in sync.'));
			return 0;
		}
		if (dryRun) {
			p.outro(`Dry run: ${writes.length} file(s) would change.`);
			return 0;
		}
		if (!yes) {
			if (!process.stdin.isTTY) {
				p.log.error('Not a TTY; pass --yes to apply (or --dry-run to preview).');
				p.outro('Nothing synced.');
				return 1;
			}
			const proceed = await p.confirm({
				message: `Write ${writes.length} file(s)?`,
				initialValue: true
			});
			if (p.isCancel(proceed) || !proceed) {
				p.outro('Nothing synced.');
				return 0;
			}
		}

		for (const change of writes) {
			const target = join(dir, change.rel);
			mkdirSync(dirname(target), { recursive: true });
			writeFileSync(target, change.content);
		}

		if (manifest?.repoAnalysis) {
			const files = { ...(manifest.repoAnalysis.files ?? {}) };
			for (const change of changes) {
				if (change.action !== 'skip' && change.rel !== 'content/_meta.json') {
					files[change.rel] = hashFile(join(dir, change.rel));
				}
			}
			manifest.repoAnalysis.files = Object.fromEntries(
				Object.entries(files).sort(([a], [b]) => a.localeCompare(b))
			);
			writeFileSync(join(dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, '\t')}\n`);
		}

		p.outro(pc.green(`Synced ${writes.length} file(s).`));
		return 0;
	} finally {
		rmSync(tmpRoot, { recursive: true, force: true });
	}
}

export function relativeToSite(dir, path) {
	return relative(dir, path).split(sep).join('/');
}
