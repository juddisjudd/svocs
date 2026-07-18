#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
	fetchAvailableModels,
	fetchRepoContext,
	FALLBACK_MODELS,
	gatherScanMaterial,
	generateHeuristicPages,
	generateLlmPages,
	parseGithubRepo,
	validateApiKey,
	writeGeneratedPages
} from './lib/repo-analysis.mjs';
import {
	DEFAULT_ACCENT,
	normalizeHexColor,
	normalizeSiteUrl,
	scaffold,
	SEARCH_BACKEND_IDS,
	SEARCH_BACKENDS,
	writeManifest
} from './lib/scaffold.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, 'template');
const SEARCH_RECIPES_DIR = join(__dirname, 'recipes', 'search');
const CLI_VERSION = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')).version;

function splitBackendLabel(label) {
	const separatorIndex = label.indexOf(' —');
	if (separatorIndex === -1) {
		return { name: label, hint: undefined };
	}
	return { name: label.slice(0, separatorIndex), hint: label.slice(separatorIndex + 2).trim() };
}

const LLM_PROVIDER_IDS = ['anthropic', 'openai', 'openrouter'];
const LLM_PROVIDER_LABELS = { anthropic: 'Anthropic', openai: 'OpenAI', openrouter: 'OpenRouter' };
const LLM_PROVIDER_ENV_VAR = {
	anthropic: 'ANTHROPIC_API_KEY',
	openai: 'OPENAI_API_KEY',
	openrouter: 'OPENROUTER_API_KEY'
};
const CUSTOM_MODEL_VALUE = '__custom__';

const SCAN_DEPTH_IDS = ['quick', 'standard', 'deep'];
const SCAN_DEPTHS = [
	{
		value: 'quick',
		label: 'Quick Scan',
		hint: '1-3 pages from the README + other .md docs; the fastest and cheapest option'
	},
	{
		value: 'standard',
		label: 'Standard Scan',
		hint: '1-8 pages, also reads root config/manifest files (default)'
	},
	{
		value: 'deep',
		label: 'Deep Scan',
		hint: '1-12 pages, downloads the whole repo and writes each page from source (several AI calls)'
	}
];

function describeRepoFetchError(error) {
	switch (error) {
		case 'rate-limited':
			return 'GitHub API rate limit hit; try again shortly';
		case 'network':
			return "Couldn't reach GitHub";
		default:
			return 'Repo not found (or private)';
	}
}

function detectPackageManager() {
	if (typeof globalThis.Deno !== 'undefined') return 'deno';
	const ua = process.env.npm_config_user_agent ?? '';
	if (ua.startsWith('bun')) return 'bun';
	if (ua.startsWith('pnpm')) return 'pnpm';
	if (ua.startsWith('yarn')) return 'yarn';
	if (ua.startsWith('nub')) return 'nub';
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

/** owner/repo shorthand or a bare https(s) URL -> a full https://github.com/... URL, or null. */
function normalizeRepoUrl(value) {
	const trimmed = value.trim();
	const parsed = parseGithubRepo(trimmed);
	if (parsed) {
		return `https://github.com/${parsed.owner}/${parsed.repo}`;
	}
	return /^https?:\/\//.test(trimmed) ? trimmed : null;
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
	if (llmProviderFlag && !LLM_PROVIDER_IDS.includes(llmProviderFlag)) {
		console.error(
			`Unknown --llm-provider: "${llmProviderFlag}". Expected one of: ${LLM_PROVIDER_IDS.join(', ')}.`
		);
		process.exitCode = 1;
		return;
	}
	const llmModelFlag = args
		.find((arg) => arg.startsWith('--llm-model='))
		?.slice('--llm-model='.length);
	const scanDepthFlag = args
		.find((arg) => arg.startsWith('--scan-depth='))
		?.slice('--scan-depth='.length);
	if (scanDepthFlag && !SCAN_DEPTH_IDS.includes(scanDepthFlag)) {
		console.error(
			`Unknown --scan-depth: "${scanDepthFlag}". Expected one of: ${SCAN_DEPTH_IDS.join(', ')}.`
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
	const siteUrlFlagRaw = args
		.find((arg) => arg.startsWith('--site-url='))
		?.slice('--site-url='.length);
	const siteUrlFlag = siteUrlFlagRaw ? normalizeSiteUrl(siteUrlFlagRaw) : undefined;
	if (siteUrlFlagRaw && !siteUrlFlag) {
		console.error(
			`Invalid --site-url value: "${siteUrlFlagRaw}". Expected an http(s) origin like https://docs.example.com.`
		);
		process.exitCode = 1;
		return;
	}
	const repoUrlFlagRaw = args
		.find((arg) => arg.startsWith('--repo-url='))
		?.slice('--repo-url='.length);
	const repoUrlFlag = repoUrlFlagRaw ? normalizeRepoUrl(repoUrlFlagRaw) : undefined;
	if (repoUrlFlagRaw && !repoUrlFlag) {
		console.error(
			`Invalid --repo-url value: "${repoUrlFlagRaw}". Expected owner/repo or a full URL like https://github.com/owner/repo.`
		);
		process.exitCode = 1;
		return;
	}
	const repoBranchFlag = args
		.find((arg) => arg.startsWith('--repo-branch='))
		?.slice('--repo-branch='.length);

	const isInteractive = Boolean(process.stdin.isTTY);

	if (isInteractive) {
		p.intro(pc.bold('create-svocs-docs'));
	}

	// Clack prompts resolve to a cancel symbol on Ctrl+C instead of throwing.
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

	function providerLabel(provider) {
		return LLM_PROVIDER_LABELS[provider] ?? provider;
	}

	async function validateAndReportKey(provider, apiKey) {
		const name = providerLabel(provider);
		const s = p.spinner();
		s.start(`Validating ${name} API key`);
		const isValid = await validateApiKey(provider, apiKey);
		if (isValid) {
			s.stop(`${name} API key validated ✓`);
		} else {
			s.error(`${name} API key invalid ✗`);
		}
		return isValid;
	}

	async function askLlmModel(provider, apiKey) {
		if (!isInteractive) return undefined;

		const s = p.spinner();
		s.start('Fetching available models');
		const fetched = await fetchAvailableModels(provider, apiKey);
		if (fetched?.length) {
			s.stop(`Found ${fetched.length} model${fetched.length === 1 ? '' : 's'}`);
		} else {
			s.error("Couldn't fetch the model list; showing a small fallback set");
		}

		const models = fetched?.length ? fetched : FALLBACK_MODELS[provider];
		const options = [
			...models.map((m) => ({
				value: m.id,
				label: m.id,
				hint: m.name && m.name !== m.id ? m.name : undefined
			})),
			{ value: CUSTOM_MODEL_VALUE, label: 'Custom model ID…' }
		];

		const choice = orExit(
			await p.autocomplete({
				message: 'Model',
				placeholder: 'Type to search…',
				maxItems: 10,
				options
			})
		);
		if (choice !== CUSTOM_MODEL_VALUE) {
			return choice;
		}
		return orExit(await p.text({ message: 'Model ID', placeholder: 'e.g. gpt-5.4' }));
	}

	async function askScanDepth() {
		if (!isInteractive) return 'standard';
		return orExit(
			await p.select({ message: 'Scan depth', initialValue: 'standard', options: SCAN_DEPTHS })
		);
	}

	async function askSiteUrl() {
		if (!isInteractive) return '';
		const answer = orExit(
			await p.text({
				message: 'Production URL (enables social cards, sitemap & AI links; skip if unknown)',
				placeholder: 'https://docs.example.com',
				defaultValue: '',
				validate: (value) =>
					!value || normalizeSiteUrl(value) !== null
						? undefined
						: 'Enter an http(s) origin like https://docs.example.com, or leave empty'
			})
		);
		return answer ? (normalizeSiteUrl(answer) ?? '') : '';
	}

	async function askRepoLink(defaultUrl) {
		if (!isInteractive) return defaultUrl;
		const answer = orExit(
			await p.text({
				message: 'Repository URL (adds a GitHub button to the header and "Edit on GitHub"; optional)',
				placeholder: defaultUrl || 'owner/repo or full URL',
				defaultValue: defaultUrl,
				validate: (value) =>
					!value || normalizeRepoUrl(value) !== null
						? undefined
						: 'Enter owner/repo, a full URL, or leave empty'
			})
		);
		return answer ? (normalizeRepoUrl(answer) ?? '') : '';
	}

	async function askDeployTarget() {
		if (!isInteractive) return 'static';
		return orExit(
			await p.select({
				message: 'Where will this deploy?',
				initialValue: 'static',
				options: [
					{
						value: 'static',
						label: 'Static host',
						hint: 'Cloudflare, Netlify, Vercel, your own server (default)'
					},
					{
						value: 'gh-pages',
						label: 'GitHub Pages',
						hint: 'project sites are served under /<repo> and need a base path'
					}
				]
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
	let repoSlug = null;
	let repoAnalysisMode = null;
	let llmProvider = null;
	let llmApiKey = '';
	let llmModel = null;
	let scanDepth = 'standard';

	async function fetchAndReportRepo(owner, repo) {
		const s = p.spinner();
		s.start(`Fetching ${owner}/${repo}`);
		const context = await fetchRepoContext(owner, repo);
		if (context?.error) {
			s.error(`${describeRepoFetchError(context.error)}. Skipping analysis.`);
			return null;
		}
		s.stop(`Fetched ${owner}/${repo}`);
		return context;
	}

	async function gatherScanMaterialAndReport(owner, repo) {
		const s = p.spinner();
		s.start(`Gathering repo material (${scanDepth} scan)`);
		let warning = null;
		const material = await gatherScanMaterial(owner, repo, repoContext, scanDepth, (message) => {
			warning = message;
		});
		repoContext = { ...repoContext, ...material };
		s.stop('Gathered repo material');
		if (warning) {
			p.log.warn(warning);
		}
	}

	if (repoFlag) {
		const parsed = parseGithubRepo(repoFlag);
		if (!parsed) {
			p.log.warn(`Couldn't parse "--repo=${repoFlag}" as a GitHub repo; skipping analysis.`);
		} else {
			repoSlug = parsed;
			repoContext = await fetchAndReportRepo(parsed.owner, parsed.repo);
			if (repoContext) {
				repoAnalysisMode = repoModeFlag ?? 'heuristic';
				llmProvider = llmProviderFlag ?? 'anthropic';
				if (repoAnalysisMode === 'llm') {
					llmApiKey = process.env[LLM_PROVIDER_ENV_VAR[llmProvider]] ?? '';
					llmModel = llmModelFlag;
					scanDepth = scanDepthFlag ?? 'standard';
					if (llmApiKey && !(await validateAndReportKey(llmProvider, llmApiKey))) {
						llmApiKey = '';
					}
					if (llmApiKey) {
						await gatherScanMaterialAndReport(parsed.owner, parsed.repo);
					}
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
				p.log.warn("Couldn't parse that as a GitHub repo; skipping analysis.");
			} else {
				repoSlug = parsed;
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
									hint: 'splits the README into pages, no API key needed'
								},
								{
									value: 'llm',
									label: 'LLM-powered',
									hint: 'an AI writes the docs pages (bring your own key)'
								}
							]
						})
					);

					if (repoAnalysisMode === 'llm') {
						llmProvider = orExit(
							await p.select({
								message: 'LLM provider',
								initialValue: 'anthropic',
								options: LLM_PROVIDER_IDS.map((id) => ({
									value: id,
									label: LLM_PROVIDER_LABELS[id]
								}))
							})
						);
						llmApiKey = await askSecret(
							`${providerLabel(llmProvider)} API key (used once, never saved)`
						);
						if (!llmApiKey) {
							p.log.warn('No key entered; using heuristic analysis instead.');
							repoAnalysisMode = 'heuristic';
						} else if (!(await validateAndReportKey(llmProvider, llmApiKey))) {
							llmApiKey = '';
							repoAnalysisMode = 'heuristic';
							p.log.warn('Falling back to heuristic analysis.');
						} else {
							llmModel = await askLlmModel(llmProvider, llmApiKey);
							scanDepth = await askScanDepth();
							await gatherScanMaterialAndReport(parsed.owner, parsed.repo);
						}
					}
				}
			}
		}
	}

	const suggestedSiteName = repoContext?.name ? toSiteName(repoContext.name) : toSiteName(dirName);
	const siteName = await ask('Site name', suggestedSiteName);
	const packageName = toPackageName(dirName);
	const siteUrl = siteUrlFlag ?? (await askSiteUrl());
	const suggestedRepoUrl = repoSlug ? `https://github.com/${repoSlug.owner}/${repoSlug.repo}` : '';
	const repoUrl = repoUrlFlag ?? (await askRepoLink(suggestedRepoUrl));
	const repoBranch = repoBranchFlag ?? '';
	const accentColor = accentFlag ?? (await askAccentColor());
	const searchBackend = searchFlag ?? (await askSearchBackend());
	const deployTarget = await askDeployTarget();
	const shouldInitGit = await confirm('Initialize a git repository?', true);

	const scaffoldOptions = {
		siteName,
		packageName,
		accentColor,
		searchBackend,
		siteUrl,
		repoUrl,
		repoBranch
	};
	const scaffoldSpinner = p.spinner();
	scaffoldSpinner.start(`Scaffolding "${siteName}"`);
	scaffold(targetDir, scaffoldOptions, {
		templateDir: TEMPLATE_DIR,
		recipesDir: SEARCH_RECIPES_DIR
	});
	// Recorded before repo-analysis content lands, so generated pages count
	// as user content and `svocs update` never touches them.
	writeManifest(targetDir, CLI_VERSION, scaffoldOptions);
	scaffoldSpinner.stop(`Scaffolded "${siteName}" in ${targetDir}`);

	if (repoContext && repoAnalysisMode) {
		let generatedPages = null;
		if (repoAnalysisMode === 'llm') {
			if (!llmApiKey) {
				p.log.warn('No LLM key available; using heuristic analysis instead.');
			} else {
				const providerName = providerLabel(llmProvider);
				const s = p.spinner();
				s.start(`Asking ${providerName} to analyze the repo (no timeout; press Ctrl+C to cancel)`);
				let warning = null;
				generatedPages = await generateLlmPages(
					repoContext,
					llmProvider,
					llmApiKey,
					llmModel,
					scanDepth,
					(message) => {
						warning = message;
					},
					(message) => s.message(message)
				);
				if (!generatedPages) {
					s.error(warning ?? `${providerName} analysis failed`);
				} else {
					s.stop(`${providerName} analysis complete`);
					if (warning) {
						p.log.warn(warning);
					}
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
				"Couldn't generate any content from that repo; leaving the starter content as-is."
			);
		}
	}

	if (shouldInitGit) {
		const gitDir = join(targetDir, '.git');
		if (!existsSync(gitDir)) {
			const result = spawnSync('git', ['init'], { cwd: targetDir, stdio: 'ignore' });
			if (result.error || result.status !== 0) {
				p.log.warn('Skipped git init (git not available).');
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
		nub: 'nub install',
		deno: null
	}[pm];
	const devCmd = {
		bun: 'bun run dev',
		pnpm: 'pnpm dev',
		yarn: 'yarn dev',
		npm: 'npm run dev',
		nub: 'nub run dev',
		deno: 'deno task dev'
	}[pm];
	const buildCmd = {
		bun: 'bun run build',
		pnpm: 'pnpm build',
		yarn: 'yarn build',
		npm: 'npm run build',
		nub: 'nub run build',
		deno: 'deno task build'
	}[pm];
	const previewCmd = {
		bun: 'bun run preview',
		pnpm: 'pnpm preview',
		yarn: 'yarn preview',
		npm: 'npm run preview',
		nub: 'nub run preview',
		deno: 'deno task preview'
	}[pm];

	const steps = [
		relativeDir !== '.' ? { cmd: `cd ${relativeDir}` } : null,
		installCmd ? { cmd: installCmd } : null,
		{ cmd: devCmd, note: 'starts the dev server, with hot reload' },
		{ cmd: buildCmd },
		{ cmd: previewCmd, note: 'serves the production build locally' }
	].filter(Boolean);

	const commandColumnWidth = Math.max(...steps.map((step) => step.cmd.length));
	const nextSteps = steps
		.map(({ cmd, note }) =>
			note ? `${pc.cyan(cmd.padEnd(commandColumnWidth))}  ${pc.dim(note)}` : pc.cyan(cmd)
		)
		.join('\n');
	p.note(nextSteps, 'Next steps');

	const backendNextSteps = SEARCH_BACKENDS[searchBackend]?.nextSteps;
	if (backendNextSteps) {
		const backendName = splitBackendLabel(SEARCH_BACKENDS[searchBackend].label).name;
		p.note(backendNextSteps.join('\n'), `${backendName} setup`);
	}

	if (deployTarget === 'gh-pages') {
		const suggestedBase = `/${repoSlug?.repo ?? packageName}`;
		p.note(
			[
				`Project sites are served under a sub-path, so build with ${pc.cyan(`BASE_PATH=${suggestedBase}`)}.`,
				'Deploying to a custom domain or <user>.github.io root? Skip BASE_PATH.',
				'Guide: https://svocs.dev/docs/deployment/github-pages'
			].join('\n'),
			'GitHub Pages'
		);
	}

	if (!siteUrl) {
		p.note(
			[
				`Set ${pc.cyan('SITE_URL')} in src/lib/site.ts once you know your domain.`,
				'Until then social-card tags are off, sitemap.xml is empty, and',
				'llms.txt links stay relative. https://svocs.dev/docs/og-images'
			].join('\n'),
			'Before you deploy'
		);
	}

	if (!repoUrl) {
		p.note(
			[
				`No repo yet? Set ${pc.cyan('REPO_URL')} in src/lib/site.ts once you have one.`,
				'It turns on the header GitHub button and an "Edit on GitHub" button on',
				'every page — both stay hidden until then. https://svocs.dev/docs/ai'
			].join('\n'),
			'Optional: link a repo'
		);
	}

	p.outro(pc.bold('Done.'));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
