#!/usr/bin/env node
import { existsSync, readdirSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
	fetchRepoContext,
	generateHeuristicPages,
	generateLlmPages,
	parseGithubRepo,
	writeGeneratedPages
} from './lib/repo-analysis.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, 'template');
const SEARCH_RECIPES_DIR = join(__dirname, 'recipes', 'search');

const RENAMES = {
	_gitignore: '.gitignore',
	_npmrc: '.npmrc',
	_nojekyll: '.nojekyll'
};

// Pagefind ships wired up in the base template; the rest are recipes under
// recipes/search/<id>/ that get merged into the scaffold on demand — see
// applySearchBackend(). Order here is display order in the prompt.
const SEARCH_BACKEND_IDS = ['pagefind', 'orama', 'flexsearch', 'typesense', 'chroma'];

const SEARCH_BACKENDS = {
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
			'`bun run build` will fail until those are set — dev/preview still work, search just errors.',
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
			'`bun run build` will fail until those are set — dev/preview still work, search just errors.',
			'The sync script always runs via `bun`, even if you scaffolded with another package manager.',
			'Read the security section before deploying: https://svocs.dev/docs/search/chroma'
		]
	}
};

/** Backend labels are "Name — detail"; the select prompt wants those as
 *  separate label/hint fields, and a couple of other spots just want the name. */
function splitBackendLabel(label) {
	const separatorIndex = label.indexOf(' —');
	if (separatorIndex === -1) {
		return { name: label, hint: undefined };
	}
	return { name: label.slice(0, separatorIndex), hint: label.slice(separatorIndex + 2).trim() };
}

const DEFAULT_ACCENT = '#ff3c00';

function normalizeHexColor(input) {
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

/** Only touches src/routes/+layout.svelte — --accent is the one literal
 *  color left in the theme block; --accent-soft/--accent-strong/--glow-a
 *  derive from it via color-mix(), so swapping this one line is enough to
 *  re-theme the whole scaffolded site coherently. */
function applyAccentColor(targetDir, hex) {
	if (!hex || hex === DEFAULT_ACCENT) {
		return;
	}
	const layoutPath = join(targetDir, 'src/routes/+layout.svelte');
	const content = readFileSync(layoutPath, 'utf8');
	writeFileSync(
		layoutPath,
		content.replaceAll(`--accent: ${DEFAULT_ACCENT};`, `--accent: ${hex};`)
	);
}

function describeRepoFetchError(error) {
	switch (error) {
		case 'rate-limited':
			return 'GitHub API rate limit hit — try again shortly';
		case 'network':
			return "Couldn't reach GitHub";
		default:
			return 'Repo not found (or private)';
	}
}

function sortObjectKeys(obj) {
	return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
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

/** Merges a backend's recipe files in, then rewires resolver.ts, the
 *  vite/postbuild provider defaults, and package.json/deno.json so the
 *  scaffolded project boots straight into the chosen backend. No-op for
 *  pagefind, which the base template already wires up. */
function applySearchBackend(targetDir, backendId) {
	if (backendId === 'pagefind') {
		return;
	}

	const backend = SEARCH_BACKENDS[backendId];
	copyTemplate(join(SEARCH_RECIPES_DIR, backendId), targetDir);

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

// Files that get __SITE_NAME__ / __PACKAGE_NAME__ substitution — every text
// file we ship, matched by extension rather than a hardcoded path list so
// future template additions don't need this list updated too.
const TEXT_EXTENSIONS = new Set([
	'.md',
	'.svx',
	'.json',
	'.js',
	'.ts',
	'.svelte',
	'.html',
	'.txt',
	''
]);

function detectPackageManager() {
	if (typeof globalThis.Deno !== 'undefined') return 'deno';
	const ua = process.env.npm_config_user_agent ?? '';
	if (ua.startsWith('bun')) return 'bun';
	if (ua.startsWith('pnpm')) return 'pnpm';
	if (ua.startsWith('yarn')) return 'yarn';
	return 'npm';
}

function toPackageName(name) {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-~]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'svocs-docs';
}

function toSiteName(dirName) {
	return dirName
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function isDirEmpty(dir) {
	return !existsSync(dir) || readdirSync(dir).length === 0;
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

async function main() {
	const args = process.argv.slice(2);
	const targetArg = args.find((arg) => !arg.startsWith('-'));
	const searchFlag = args.find((arg) => arg.startsWith('--search='))?.slice('--search='.length);
	if (searchFlag && !SEARCH_BACKEND_IDS.includes(searchFlag)) {
		console.error(
			`Unknown --search backend: "${searchFlag}". Expected one of: ${SEARCH_BACKEND_IDS.join(', ')}.`
		);
		process.exitCode = 1;
		return;
	}
	const repoFlag = args.find((arg) => arg.startsWith('--repo='))?.slice('--repo='.length);
	const repoModeFlag = args
		.find((arg) => arg.startsWith('--repo-mode='))
		?.slice('--repo-mode='.length);
	const llmProviderFlag = args
		.find((arg) => arg.startsWith('--llm-provider='))
		?.slice('--llm-provider='.length);
	if (repoModeFlag && !['heuristic', 'llm'].includes(repoModeFlag)) {
		console.error(`Unknown --repo-mode: "${repoModeFlag}". Expected "heuristic" or "llm".`);
		process.exitCode = 1;
		return;
	}
	if (llmProviderFlag && !['anthropic', 'openai'].includes(llmProviderFlag)) {
		console.error(
			`Unknown --llm-provider: "${llmProviderFlag}". Expected "anthropic" or "openai".`
		);
		process.exitCode = 1;
		return;
	}
	const accentFlagRaw = args.find((arg) => arg.startsWith('--accent='))?.slice('--accent='.length);
	const accentFlag = accentFlagRaw ? normalizeHexColor(accentFlagRaw) : undefined;
	if (accentFlagRaw && !accentFlag) {
		console.error(`Invalid --accent value: "${accentFlagRaw}". Expected a hex color like #2563eb.`);
		process.exitCode = 1;
		return;
	}

	const isInteractive = Boolean(process.stdin.isTTY);

	if (isInteractive) {
		p.intro(pc.bold('create-svocs-docs'));
	}

	// Every clack prompt resolves to a symbol instead of throwing when the
	// user hits Ctrl+C — this is the one place that checks for it, so every
	// `ask*`/`confirm` helper below can await a prompt without its own
	// cancellation boilerplate.
	function orExit(value) {
		if (p.isCancel(value)) {
			p.cancel('Cancelled.');
			process.exit(0);
		}
		return value;
	}

	async function ask(message, fallback) {
		if (!isInteractive) return fallback;
		return orExit(
			await p.text({ message, placeholder: fallback || undefined, defaultValue: fallback })
		);
	}

	async function confirm(message, fallback) {
		if (!isInteractive) return fallback;
		return orExit(await p.confirm({ message, initialValue: fallback }));
	}

	async function askSecret(message) {
		if (!isInteractive) return '';
		return orExit(await p.password({ message }));
	}

	async function askAccentColor() {
		if (!isInteractive) return DEFAULT_ACCENT;
		const answer = orExit(
			await p.text({
				message: 'Accent color (hex)',
				placeholder: DEFAULT_ACCENT,
				defaultValue: DEFAULT_ACCENT,
				validate: (value) =>
					!value || normalizeHexColor(value) ? undefined : 'Enter a hex color like #2563eb'
			})
		);
		return normalizeHexColor(answer) ?? DEFAULT_ACCENT;
	}

	async function askSearchBackend() {
		if (!isInteractive) return 'pagefind';
		return orExit(
			await p.select({
				message: 'Search backend',
				initialValue: 'pagefind',
				options: SEARCH_BACKEND_IDS.map((id) => {
					const { name, hint } = splitBackendLabel(SEARCH_BACKENDS[id].label);
					return { value: id, label: name, hint };
				})
			})
		);
	}

	const targetDir = resolve(targetArg ?? (await ask('Project directory', 'my-docs')));
	const dirName = basename(targetDir);

	if (existsSync(targetDir) && !isDirEmpty(targetDir)) {
		const proceed = await confirm(
			`"${dirName}" already exists and isn't empty. Continue anyway?`,
			false
		);
		if (!proceed) {
			if (isInteractive) p.cancel('Aborted.');
			else console.log('Aborted.');
			process.exitCode = 1;
			return;
		}
	}

	let repoContext = null;
	let repoAnalysisMode = null;
	let llmProvider = null;
	let llmApiKey = '';

	async function fetchAndReportRepo(owner, repo) {
		const s = p.spinner();
		s.start(`Fetching ${owner}/${repo}`);
		const context = await fetchRepoContext(owner, repo);
		if (context?.error) {
			s.error(`${describeRepoFetchError(context.error)} — skipping analysis.`);
			return null;
		}
		s.stop(`Fetched ${owner}/${repo}`);
		return context;
	}

	if (repoFlag) {
		const parsed = parseGithubRepo(repoFlag);
		if (!parsed) {
			p.log.warn(`Couldn't parse "--repo=${repoFlag}" as a GitHub repo — skipping analysis.`);
		} else {
			repoContext = await fetchAndReportRepo(parsed.owner, parsed.repo);
			if (repoContext) {
				repoAnalysisMode = repoModeFlag ?? 'heuristic';
				llmProvider = llmProviderFlag ?? 'anthropic';
				if (repoAnalysisMode === 'llm') {
					llmApiKey =
						(llmProvider === 'openai'
							? process.env.OPENAI_API_KEY
							: process.env.ANTHROPIC_API_KEY) ?? '';
				}
			}
		}
	} else if (isInteractive) {
		const wantsAnalysis = await confirm(
			'Analyze an existing GitHub repo for a baseline docs setup?',
			false
		);
		if (wantsAnalysis) {
			const repoInput = await ask('GitHub repo (owner/repo or URL)', '');
			const parsed = parseGithubRepo(repoInput);
			if (!parsed) {
				p.log.warn("Couldn't parse that as a GitHub repo — skipping analysis.");
			} else {
				repoContext = await fetchAndReportRepo(parsed.owner, parsed.repo);
				if (repoContext) {
					repoAnalysisMode = orExit(
						await p.select({
							message: 'Analysis mode',
							initialValue: 'heuristic',
							options: [
								{
									value: 'heuristic',
									label: 'Heuristic',
									hint: 'reorganizes the README, no AI, no key needed'
								},
								{
									value: 'llm',
									label: 'LLM-powered',
									hint: 'an AI rewrites the content into docs pages (bring your own key)'
								}
							]
						})
					);

					if (repoAnalysisMode === 'llm') {
						llmProvider = orExit(
							await p.select({
								message: 'LLM provider',
								initialValue: 'anthropic',
								options: [
									{ value: 'anthropic', label: 'Anthropic' },
									{ value: 'openai', label: 'OpenAI' }
								]
							})
						);
						llmApiKey = await askSecret(
							`${llmProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API key (used once, never saved)`
						);
						if (!llmApiKey) {
							p.log.warn('No key entered — using heuristic analysis instead.');
							repoAnalysisMode = 'heuristic';
						}
					}
				}
			}
		}
	}

	const suggestedSiteName = repoContext?.name ? toSiteName(repoContext.name) : toSiteName(dirName);
	const siteName = await ask('Site name', suggestedSiteName);
	const packageName = toPackageName(dirName);
	const accentColor = accentFlag ?? (await askAccentColor());
	const searchBackend = searchFlag ?? (await askSearchBackend());
	const shouldInitGit = await confirm('Initialize a git repository?', true);

	const scaffoldSpinner = p.spinner();
	scaffoldSpinner.start(`Scaffolding "${siteName}"`);
	copyTemplate(TEMPLATE_DIR, targetDir);
	applySubstitutions(targetDir, siteName, packageName);
	applyAccentColor(targetDir, accentColor);
	applySearchBackend(targetDir, searchBackend);
	scaffoldSpinner.stop(`Scaffolded "${siteName}" in ${targetDir}`);

	if (repoContext && repoAnalysisMode) {
		let generatedPages = null;
		if (repoAnalysisMode === 'llm') {
			if (!llmApiKey) {
				p.log.warn('No LLM key available — using heuristic analysis instead.');
			} else {
				const providerName = llmProvider === 'openai' ? 'OpenAI' : 'Anthropic';
				const s = p.spinner();
				s.start(`Asking ${providerName} to analyze the repo`);
				let warning = null;
				generatedPages = await generateLlmPages(repoContext, llmProvider, llmApiKey, (message) => {
					warning = message;
				});
				if (warning) {
					s.error(warning);
				} else {
					s.stop(`${providerName} analysis complete`);
				}
			}
		}
		if (!generatedPages) {
			generatedPages = generateHeuristicPages(repoContext);
		}
		if (generatedPages.length > 0) {
			writeGeneratedPages(targetDir, generatedPages);
			p.log.success(`Generated ${generatedPages.length} docs page(s) from the repo.`);
		} else {
			p.log.warn(
				"Couldn't generate any content from that repo — leaving the starter content as-is."
			);
		}
	}

	if (shouldInitGit) {
		const gitDir = join(targetDir, '.git');
		if (!existsSync(gitDir)) {
			const result = spawnSync('git', ['init'], { cwd: targetDir, stdio: 'ignore' });
			if (result.error || result.status !== 0) {
				p.log.warn('Skipped git init — git not available.');
			}
		}
	}

	const pm = detectPackageManager();
	const relativeDir = targetDir === process.cwd() ? '.' : dirName;

	const installCmd = {
		bun: 'bun install',
		pnpm: 'pnpm install',
		yarn: 'yarn',
		npm: 'npm install',
		deno: null
	}[pm];
	const devCmd = {
		bun: 'bun run dev',
		pnpm: 'pnpm dev',
		yarn: 'yarn dev',
		npm: 'npm run dev',
		deno: 'deno task dev'
	}[pm];

	const nextSteps = [relativeDir !== '.' ? `cd ${relativeDir}` : null, installCmd, devCmd]
		.filter(Boolean)
		.map((step) => pc.cyan(step))
		.join('\n');
	p.note(nextSteps, 'Next steps');

	const backendNextSteps = SEARCH_BACKENDS[searchBackend]?.nextSteps;
	if (backendNextSteps) {
		const backendName = splitBackendLabel(SEARCH_BACKENDS[searchBackend].label).name;
		p.note(backendNextSteps.join('\n'), `${backendName} setup`);
	}

	p.outro(pc.bold('Done.'));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
