// Keeps packages/create-svocs-docs in step with this site. The root src/ is
// where features land; the template and search recipes are derived from it.
//
//   node scripts/sync-template.mjs          copy shared files into the template
//   node scripts/sync-template.mjs --check  exit 1 if the template is stale (CI)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const PACKAGE = join(ROOT, 'packages/create-svocs-docs');
const TEMPLATE = join(PACKAGE, 'template');
const RECIPES = join(PACKAGE, 'recipes/search');

// Files and directories every SVOCS site shares. Anything not listed here is
// site-specific (landing page, site.ts, app.html analytics, sitemap routes,
// the multi-provider search resolver) and owned by the template separately.
const SHARED = [
	'src/app.d.ts',
	'src/virtual.d.ts',
	'src/lib/build',
	'src/lib/components',
	'src/lib/core',
	'src/lib/icons',
	'src/lib/index.ts',
	'src/lib/server',
	'src/lib/themes',
	'src/lib/types',
	'src/lib/search/types.ts',
	'src/lib/search/providers/pagefind-client.ts',
	'src/routes/+error.svelte',
	'src/routes/docs',
	'src/routes/llms.txt',
	'src/routes/llms-full.txt',
	'src/routes/search-index.json',
	'scripts/og/generate.mjs',
	'scripts/search/postbuild.mjs'
];

// Provider-specific files live in recipes/, applied by the scaffolder when
// that backend is picked.
const RECIPE_FILES = {
	orama: [
		'src/lib/search/providers/orama-client.ts',
		'src/lib/search/providers/orama-indexer.ts',
		'src/routes/search-index.orama.json/+server.ts'
	],
	flexsearch: [
		'src/lib/search/providers/flexsearch-client.ts',
		'src/lib/search/providers/flexsearch-config.ts',
		'src/lib/search/providers/flexsearch-indexer.ts',
		'src/routes/search-index.flexsearch.json/+server.ts'
	],
	typesense: ['src/lib/search/providers/typesense-client.ts', 'scripts/search/sync-typesense.ts'],
	chroma: ['src/lib/search/providers/chroma-client.ts', 'scripts/search/sync-chroma.ts']
};

const EXCLUDE = /\.(test|spec)\.[cm]?[jt]s$/;

/** Site-specific strings the template carries as placeholders. */
function toTemplate(source) {
	return source
		.replace(/\| SVOCS Docs/g, '| __SITE_NAME__')
		.replace(/\| SVOCS(?=[<\s])/g, '| __SITE_NAME__');
}

function listFiles(path) {
	const full = join(ROOT, path);
	if (!existsSync(full)) {
		throw new Error(`sync-template: ${path} does not exist`);
	}
	const out = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const entryPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(entryPath);
			} else if (!EXCLUDE.test(entry.name)) {
				out.push(relative(ROOT, entryPath).split(sep).join('/'));
			}
		}
	};
	const stat = readdirSync(dirname(full), { withFileTypes: true }).find(
		(entry) => join(dirname(full), entry.name) === full
	);
	if (stat?.isDirectory()) {
		walk(full);
	} else {
		out.push(path);
	}
	return out;
}

function plan() {
	const items = [];
	for (const path of SHARED) {
		for (const rel of listFiles(path)) {
			items.push({ rel, dest: join(TEMPLATE, rel) });
		}
	}
	for (const [backend, files] of Object.entries(RECIPE_FILES)) {
		for (const rel of files) {
			items.push({ rel, dest: join(RECIPES, backend, rel) });
		}
	}
	return items.map((item) => {
		const expected = toTemplate(readFileSync(join(ROOT, item.rel), 'utf8'));
		const current = existsSync(item.dest) ? readFileSync(item.dest, 'utf8') : null;
		return { ...item, expected, stale: current !== expected, missing: current === null };
	});
}

const check = process.argv.includes('--check');
const items = plan();
const stale = items.filter((item) => item.stale);

if (check) {
	for (const item of stale) {
		console.log(`${item.missing ? 'missing' : 'stale'}  ${relative(ROOT, item.dest)}`);
	}
	if (stale.length > 0) {
		console.error(
			`\nsync-template: ${stale.length} template file(s) out of date. Run: node scripts/sync-template.mjs`
		);
		process.exit(1);
	}
	console.log(`sync-template: ${items.length} files in sync.`);
} else {
	for (const item of stale) {
		mkdirSync(dirname(item.dest), { recursive: true });
		writeFileSync(item.dest, item.expected);
		console.log(`${item.missing ? 'added  ' : 'updated'}  ${relative(ROOT, item.dest)}`);
	}
	console.log(
		`sync-template: ${stale.length} file(s) written, ${items.length - stale.length} unchanged.`
	);
}
