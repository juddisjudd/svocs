// The scaffold pipeline, kept separate from bin.js prompting so other tools
// can rebuild a scaffold deterministically from recorded options. `svocs
// update` imports this file out of the published tarball to compute what an
// untouched scaffold of the new template would look like.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MANIFEST_FILE = '.svocs.json';

const RENAMES = {
	_gitignore: '.gitignore',
	_npmrc: '.npmrc',
	_nojekyll: '.nojekyll'
};

// Order here is display order in the prompt.
export const SEARCH_BACKEND_IDS = ['pagefind', 'orama', 'flexsearch', 'typesense', 'chroma'];

export const SEARCH_BACKENDS = {
	pagefind: {
		label: 'Pagefind — zero-config, no server (default)'
	},
	orama: {
		label: 'Orama — static JSON index, no server',
		dependencies: { '@orama/orama': '^3.1.18' }
	},
	flexsearch: {
		label: 'FlexSearch — static JSON index, no server',
		dependencies: { flexsearch: '^0.8.212' }
	},
	typesense: {
		label: 'Typesense — needs a running Typesense server',
		dependencies: { typesense: '^3.0.6' },
		scripts: { 'search:sync:typesense': 'bun run scripts/search/sync-typesense.ts' },
		nextSteps: [
			'Typesense needs a running server (self-hosted or Typesense Cloud) plus env vars:',
			'  sync-only:   TYPESENSE_HOST, TYPESENSE_ADMIN_API_KEY',
			'  client-safe: PUBLIC_TYPESENSE_HOST, PUBLIC_TYPESENSE_COLLECTION_NAME, PUBLIC_TYPESENSE_SEARCH_API_KEY',
			'`bun run build` will fail until those are set. Dev/preview still work; search just errors.',
			'The sync script always runs via `bun`, even if you scaffolded with another package manager.',
			'Full setup: https://svocs.dev/docs/search/typesense'
		]
	},
	chroma: {
		label: 'Chroma — semantic search, needs a running Chroma server',
		dependencies: { chromadb: '^3.5.0', '@chroma-core/default-embed': '^0.1.9' },
		scripts: { 'search:sync:chroma': 'bun run scripts/search/sync-chroma.ts' },
		nextSteps: [
			'Chroma needs a running server plus env vars:',
			'  sync-only:   CHROMA_HOST, CHROMA_ADMIN_TOKEN',
			'  client-safe: PUBLIC_CHROMA_HOST, PUBLIC_CHROMA_COLLECTION_NAME, PUBLIC_CHROMA_TOKEN',
			'`bun run build` will fail until those are set. Dev/preview still work; search just errors.',
			'The sync script always runs via `bun`, even if you scaffolded with another package manager.',
			'Read the security section before deploying: https://svocs.dev/docs/search/chroma'
		]
	}
};

export const DEFAULT_ACCENT = '#ff3c00';

export function normalizeHexColor(input) {
	const match = input.trim().match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
	if (!match) return null;
	const hex = match[1];
	const expanded =
		hex.length === 3
			? hex
					.split('')
					.map((c) => c + c)
					.join('')
			: hex;
	return `#${expanded.toLowerCase()}`;
}

export function normalizeSiteUrl(input) {
	const trimmed = input.trim().replace(/\/+$/, '');
	if (!trimmed) return '';
	try {
		const url = new URL(trimmed);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return trimmed;
	} catch {
		return null;
	}
}

// Files that get __SITE_NAME__ / __PACKAGE_NAME__ substitution.
const TEXT_EXTENSIONS = new Set(['.md', '.svx', '.json', '.js', '.ts', '.svelte', '.html', '.txt', '']);

function sortObjectKeys(obj) {
	return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

function copyTemplate(srcDir, destDir) {
	mkdirSync(destDir, { recursive: true });
	for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
		const srcPath = join(srcDir, entry.name);
		const destName = RENAMES[entry.name] ?? entry.name;
		const destPath = join(destDir, destName);

		if (entry.isDirectory()) {
			copyTemplate(srcPath, destPath);
			continue;
		}

		const contents = readFileSync(srcPath);
		writeFileSync(destPath, contents);
	}
}

function applySubstitutions(dir, siteName, packageName) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const entryPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			applySubstitutions(entryPath, siteName, packageName);
			continue;
		}

		const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
		if (!TEXT_EXTENSIONS.has(ext)) {
			continue;
		}

		const original = readFileSync(entryPath, 'utf8');
		const replaced = original
			.replaceAll('__SITE_NAME__', siteName)
			.replaceAll('__PACKAGE_NAME__', packageName);

		if (replaced !== original) {
			writeFileSync(entryPath, replaced);
		}
	}
}

// --accent is the one literal color in the theme block; the rest derive
// from it via color-mix().
function applyAccentColor(targetDir, hex) {
	if (!hex || hex === DEFAULT_ACCENT) {
		return;
	}
	const layoutPath = join(targetDir, 'src/routes/+layout.svelte');
	const content = readFileSync(layoutPath, 'utf8');
	writeFileSync(layoutPath, content.replaceAll(`--accent: ${DEFAULT_ACCENT};`, `--accent: ${hex};`));
}

function applySiteConfig(targetDir, siteUrl, repoUrl) {
	const sitePath = join(targetDir, 'src/lib/site.ts');
	let site = readFileSync(sitePath, 'utf8');
	if (siteUrl) {
		site = site.replace("export const SITE_URL = '';", `export const SITE_URL = '${siteUrl}';`);
	}
	if (repoUrl) {
		site = site.replace("export const REPO_URL = '';", `export const REPO_URL = '${repoUrl}';`);
	}
	writeFileSync(sitePath, site);

	if (siteUrl) {
		const robotsPath = join(targetDir, 'static/robots.txt');
		writeFileSync(
			robotsPath,
			readFileSync(robotsPath, 'utf8').replace(
				/# Once you've set SITE_URL in src\/lib\/site\.ts, add:\n# Sitemap: <SITE_URL>\/sitemap\.xml/,
				`Sitemap: ${siteUrl}/sitemap.xml`
			)
		);
	}
}

function buildResolverSource(backendId) {
	const activeCase =
		backendId === 'pagefind'
			? ''
			: `\t\tcase '${backendId}':\n\t\t\tcached = (await import('./providers/${backendId}-client')).createClient();\n\t\t\tbreak;\n`;

	return `import { PUBLIC_SVOCS_SEARCH_PROVIDER } from '$env/static/public';
import type { SearchClient } from './types';

let cached: SearchClient | undefined;

/**
 * Resolves the active search backend behind one function call, so the
 * search UI never needs backend-specific knowledge. See
 * https://svocs.dev/docs/search for how to add another backend: install
 * the one package it needs, drop in its provider file, and add a case here.
 */
export async function getSearchClient(): Promise<SearchClient> {
	if (cached) {
		return cached;
	}

	switch (PUBLIC_SVOCS_SEARCH_PROVIDER) {
${activeCase}\t\tdefault:
			cached = (await import('./providers/pagefind-client')).createClient();
	}

	return cached;
}
`;
}

function applySearchBackend(targetDir, backendId, recipesDir) {
	if (backendId === 'pagefind') {
		return;
	}

	const backend = SEARCH_BACKENDS[backendId];
	copyTemplate(join(recipesDir, backendId), targetDir);

	writeFileSync(join(targetDir, 'src/lib/search/resolver.ts'), buildResolverSource(backendId));

	const viteConfigPath = join(targetDir, 'vite.config.ts');
	writeFileSync(
		viteConfigPath,
		readFileSync(viteConfigPath, 'utf8').replace(
			"process.env.PUBLIC_SVOCS_SEARCH_PROVIDER ??= 'pagefind';",
			`process.env.PUBLIC_SVOCS_SEARCH_PROVIDER ??= '${backendId}';`
		)
	);

	const postbuildPath = join(targetDir, 'scripts/search/postbuild.mjs');
	writeFileSync(
		postbuildPath,
		readFileSync(postbuildPath, 'utf8').replace(
			"process.env.PUBLIC_SVOCS_SEARCH_PROVIDER || 'pagefind'",
			`process.env.PUBLIC_SVOCS_SEARCH_PROVIDER || '${backendId}'`
		)
	);

	for (const [fileName, tasksKey] of [
		['package.json', 'scripts'],
		['deno.json', 'tasks']
	]) {
		const filePath = join(targetDir, fileName);
		const data = JSON.parse(readFileSync(filePath, 'utf8'));

		if (backend.dependencies && fileName === 'package.json') {
			data.dependencies = sortObjectKeys({ ...data.dependencies, ...backend.dependencies });
		}
		if (backend.scripts) {
			data[tasksKey] = { ...data[tasksKey], ...backend.scripts };
		}

		writeFileSync(filePath, `${JSON.stringify(data, null, '\t')}\n`);
	}
}

/**
 * Produce a complete scaffold in targetDir from the template plus recorded
 * options. Deterministic: the same template version and options always
 * produce byte-identical output, which is what lets `svocs update` tell
 * user edits apart from template changes.
 */
export function scaffold(targetDir, options, { templateDir, recipesDir }) {
	const { siteName, packageName, accentColor, searchBackend, siteUrl, repoUrl } = options;
	copyTemplate(templateDir, targetDir);
	applySubstitutions(targetDir, siteName, packageName);
	applyAccentColor(targetDir, accentColor);
	applySiteConfig(targetDir, siteUrl ?? '', repoUrl ?? '');
	applySearchBackend(targetDir, searchBackend, recipesDir);
}

const HASH_EXCLUDE = new Set(['.git', 'node_modules', MANIFEST_FILE]);

export function hashScaffold(dir, prefix = '') {
	const hashes = {};
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (HASH_EXCLUDE.has(entry.name)) {
			continue;
		}
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			Object.assign(hashes, hashScaffold(full, rel));
		} else {
			hashes[rel] = createHash('sha256').update(readFileSync(full)).digest('hex');
		}
	}
	return hashes;
}

/**
 * Record what the scaffold looked like before the user touched it, so
 * `svocs update` can apply template fixes to unmodified files and leave
 * edited ones alone. Written by create-svocs-docs at scaffold time.
 */
export function writeManifest(targetDir, templateVersion, options) {
	const manifest = {
		templateVersion,
		options,
		files: sortObjectKeys(hashScaffold(targetDir))
	};
	writeFileSync(join(targetDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, '\t')}\n`);
}

export function readManifest(targetDir) {
	const path = join(targetDir, MANIFEST_FILE);
	if (!existsSync(path)) {
		return null;
	}
	return JSON.parse(readFileSync(path, 'utf8'));
}
