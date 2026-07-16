// Optional scaffolding step: analyze an existing GitHub repo and generate a
// baseline content/ tree from it instead of the generic starter pages.
//
// This is a strict, gracefully-degrading enhancement — every failure here
// (bad repo, rate limit, bad key, malformed AI output) falls back one tier
// (deep -> standard material, LLM -> heuristic -> untouched starter content)
// and nothing in this module throws past its own function or aborts the
// scaffold.
//
// Scan depths differ in what material the model sees, not just prompt words:
//   quick    — README + the repo's other markdown docs, one LLM call
//   standard — quick's material + root manifest/config files, two-phase
//   deep     — the whole repo via one tarball download; two-phase, and each
//              page is written from source files the plan picked for it
// Two-phase = one small JSON "plan" call, then one markdown call per page —
// so no single response carries a whole docs site inside JSON string
// literals, the shape that used to blow past max_tokens and truncate.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const GITHUB_API = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';
const README_CANDIDATES = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];
const MAX_README_BYTES = 300_000;
const DEFAULT_MODEL = {
	anthropic: 'claude-haiku-4-5-20251001',
	openai: 'gpt-4o-mini',
	openrouter: 'openrouter/auto'
};
// Used only when a live fetch of the provider's own model catalog fails —
// deliberately not an attempt to track each provider's latest releases.
// Providers ship new models faster than a hardcoded list can be kept
// current (openai/gpt-5.6-* and anthropic/claude-opus-4-8 both shipped
// after this file was last hand-updated), so fetchAvailableModels() below
// asks the provider directly; this is just the safety net for when that
// ask fails.
export const FALLBACK_MODELS = {
	anthropic: [
		{ id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
		{ id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
		{ id: 'claude-opus-4-8', name: 'Claude Opus 4.8' }
	],
	openai: [
		{ id: 'gpt-4o-mini', name: 'GPT-4o mini' },
		{ id: 'gpt-4o', name: 'GPT-4o' }
	],
	openrouter: [
		{ id: 'openrouter/auto', name: 'Auto (OpenRouter picks a model)' },
		{ id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
		{ id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5' }
	]
};
// Allow-list, not a block-list: OpenAI's /v1/models returns every model it
// has ever shipped in one flat list — embeddings, Whisper, TTS, DALL-E,
// moderation, ancient completion-only snapshots — mixed in with the chat
// models this CLI can actually use. An allow-list fails soft (a genuinely
// new chat model family that doesn't match just falls back to "Custom model
// ID…") where a block-list would fail hard (a new non-chat family slipping
// through and erroring only once the user tries to use it).
const OPENAI_CHAT_MODEL_PATTERN = /^(gpt-|o1|o3|o4|chatgpt)/i;
// Deep scan's file tree exists to let the model infer *what topics exist*
// (a `cli/` directory implies a CLI reference page), not to read every file
// — so it only ever needs paths, capped well below what would meaningfully
// grow the prompt.
const MAX_TREE_ENTRIES = 300;
const NOISY_PATH_SEGMENTS = new Set([
	'node_modules',
	'.git',
	'dist',
	'build',
	'.next',
	'.svelte-kit',
	'coverage',
	'vendor',
	'target',
	'__pycache__',
	'.venv'
]);
const NOISY_FILENAMES = new Set([
	'package-lock.json',
	'yarn.lock',
	'pnpm-lock.yaml',
	'bun.lock',
	'bun.lockb'
]);

// Per-call output budgets. Quick scan emits all its pages in one JSON
// response; standard/deep emit a small plan first, then one markdown body
// per page — each of these is comfortably within its budget, where the old
// single-response design regularly hit the limit and truncated mid-JSON.
const QUICK_SCAN_MAX_TOKENS = 4096;
const PLAN_MAX_TOKENS = 2048;
const PAGE_MAX_TOKENS = 4096;
const SCAN_DEPTH_MAX_PAGES = { quick: 3, standard: 8, deep: 12 };

// Material-gathering caps. Doc/root files ride along in every prompt, so
// they're capped tighter than the README; the tarball caps only bound what
// gets indexed into memory, not what reaches the model (page prompts cap
// each selected source file separately via MAX_SOURCE_FILE_BYTES).
const MAX_DOC_FILES = 8;
const MAX_DOC_FILE_BYTES = 50_000;
const MAX_ROOT_FILES = 12;
const MAX_ROOT_FILE_BYTES = 20_000;
const MAX_SOURCES_PER_PAGE = 5;
const MAX_SOURCE_FILE_BYTES = 20_000;
const MAX_TARBALL_BYTES = 100 * 1024 * 1024;
const MAX_STORED_FILE_BYTES = 100_000;
const MAX_STORED_TOTAL_BYTES = 5 * 1024 * 1024;

// Root files that answer "how do I actually run/configure this" when the
// README doesn't: manifests, container/CI setup, env templates, task runners.
const ROOT_MANIFEST_CANDIDATES = new Set([
	'pyproject.toml',
	'Cargo.toml',
	'go.mod',
	'composer.json',
	'Gemfile',
	'build.gradle',
	'build.gradle.kts',
	'pom.xml',
	'Dockerfile',
	'docker-compose.yml',
	'docker-compose.yaml',
	'compose.yaml',
	'Makefile',
	'justfile',
	'Taskfile.yml',
	'.env.example',
	'.env.sample',
	'deno.json',
	'tsconfig.json',
	'svelte.config.js',
	'vite.config.ts',
	'vite.config.js',
	'next.config.js',
	'next.config.ts'
]);

// Allow-list of what gets indexed out of a deep-scan tarball — the model
// only ever reads text, so binaries/assets are dead weight at best and
// mojibake at worst.
const TEXT_FILE_EXTENSIONS = new Set([
	'.md',
	'.mdx',
	'.markdown',
	'.txt',
	'.js',
	'.mjs',
	'.cjs',
	'.jsx',
	'.ts',
	'.mts',
	'.cts',
	'.tsx',
	'.svelte',
	'.vue',
	'.astro',
	'.py',
	'.rb',
	'.go',
	'.rs',
	'.java',
	'.kt',
	'.kts',
	'.c',
	'.h',
	'.cpp',
	'.hpp',
	'.cc',
	'.cs',
	'.php',
	'.swift',
	'.scala',
	'.sh',
	'.bash',
	'.ps1',
	'.bat',
	'.yml',
	'.yaml',
	'.toml',
	'.json',
	'.jsonc',
	'.ini',
	'.cfg',
	'.conf',
	'.env',
	'.example',
	'.sample',
	'.html',
	'.css',
	'.scss',
	'.less',
	'.sql',
	'.graphql',
	'.gql',
	'.proto',
	'.xml',
	'.gradle',
	'.properties'
]);
const EXTENSIONLESS_TEXT_FILES = new Set([
	'dockerfile',
	'makefile',
	'justfile',
	'gemfile',
	'procfile',
	'codeowners'
]);

export function parseGithubRepo(input) {
	const trimmed = (input ?? '').trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed.includes('github.com')) {
		try {
			const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
			const parts = url.pathname.split('/').filter(Boolean);
			if (parts.length < 2) {
				return null;
			}
			return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
		} catch {
			return null;
		}
	}

	const match = trimmed.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
	return match ? { owner: match[1], repo: match[2] } : null;
}

export async function fetchRepoContext(owner, repo) {
	let metadata;
	try {
		const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
			headers: {
				'User-Agent': 'create-svocs-docs',
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28'
			},
			signal: AbortSignal.timeout(15_000)
		});
		if (!res.ok) {
			return { error: res.status === 403 ? 'rate-limited' : 'not-found' };
		}
		metadata = await res.json();
	} catch {
		return { error: 'network' };
	}

	const defaultBranch = metadata.default_branch || 'main';
	const readme = await fetchRawFile(owner, repo, defaultBranch, README_CANDIDATES);
	const packageJsonRaw = await fetchRawFile(owner, repo, defaultBranch, ['package.json']);

	let packageJson = null;
	if (packageJsonRaw) {
		try {
			packageJson = JSON.parse(packageJsonRaw);
		} catch {
			packageJson = null;
		}
	}

	return {
		name: metadata.name ?? repo,
		description: metadata.description ?? null,
		defaultBranch,
		readme: readme
			? rewriteRelativeLinks(truncate(readme, MAX_README_BYTES), owner, repo, defaultBranch)
			: null,
		packageJson
	};
}

// READMEs are full of links/images relative to the repo's own file tree
// (`[LICENSE](LICENSE)`, `![screenshot](docs/img.png)`, `[Install](#install)`).
// Dropped verbatim into the new docs site those 404 — SvelteKit's prerender
// crawler follows every same-origin <a href> it finds and fails the build on
// a 404 by default. Rewriting to absolute GitHub URLs keeps the links
// genuinely useful (they still point at the right file) while taking them
// out of the crawler's same-origin scope entirely.
function rewriteRelativeLinks(markdown, owner, repo, branch) {
	const isAbsolute = (url) => /^([a-z][\w+.-]*:)?\/\//i.test(url) || url.startsWith('mailto:');

	return markdown
		.replace(/!\[([^\]]*)\]\(([^)\s]+)([^)]*)\)/g, (match, alt, url, rest) => {
			if (isAbsolute(url)) return match;
			const cleanPath = url.replace(/^\.?\//, '');
			return `![${alt}](https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}${rest})`;
		})
		.replace(/\[([^\]]*)\]\(([^)\s]+)([^)]*)\)/g, (match, text, url, rest) => {
			if (isAbsolute(url)) return match;
			if (url.startsWith('#')) return text;
			const cleanPath = url.replace(/^\.?\//, '');
			return `[${text}](https://github.com/${owner}/${repo}/blob/${branch}/${cleanPath}${rest})`;
		});
}

async function fetchRawFile(owner, repo, branch, candidates) {
	for (const filename of candidates) {
		try {
			const res = await fetch(`${RAW_BASE}/${owner}/${repo}/${branch}/${filename}`, {
				signal: AbortSignal.timeout(15_000)
			});
			if (res.ok) {
				return await res.text();
			}
		} catch {
			// try the next filename candidate
		}
	}
	return null;
}

function truncate(text, maxBytes) {
	return text.length <= maxBytes ? text : `${text.slice(0, maxBytes)}\n\n[truncated]`;
}

function isNoisyPath(path) {
	const segments = path.split('/');
	if (NOISY_FILENAMES.has(segments[segments.length - 1])) {
		return true;
	}
	return segments.some((segment) => NOISY_PATH_SEGMENTS.has(segment));
}

async function fetchFileTree(owner, repo, branch) {
	try {
		const res = await fetch(
			`${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
			{
				headers: {
					'User-Agent': 'create-svocs-docs',
					Accept: 'application/vnd.github+json',
					'X-GitHub-Api-Version': '2022-11-28'
				},
				signal: AbortSignal.timeout(15_000)
			}
		);
		if (!res.ok) {
			return null;
		}
		const data = await res.json();
		if (!Array.isArray(data.tree)) {
			return null;
		}
		return data.tree
			.filter((entry) => entry.type === 'blob' && !isNoisyPath(entry.path))
			.map((entry) => entry.path)
			.slice(0, MAX_TREE_ENTRIES);
	} catch {
		return null;
	}
}

// Gathers whatever material the chosen scan depth feeds the model, beyond
// the README/package.json that fetchRepoContext already got. Deep scan is a
// single tarball download rather than per-file API calls — the unauthenticated
// GitHub REST API allows only 60 requests/hour, which file-by-file fetching
// would burn instantly, while codeload tarballs aren't drawn from that quota.
// If the tarball fails, deep degrades to standard-depth material (and says
// so via onWarning) instead of aborting the analysis.
export async function gatherScanMaterial(owner, repo, repoContext, scanDepth, onWarning) {
	const branch = repoContext.defaultBranch;
	const material = { fileTree: null, docFiles: [], rootFiles: [], repoFiles: null };

	if (scanDepth === 'deep') {
		const repoFiles = await downloadRepoTarball(owner, repo, branch);
		if (repoFiles) {
			material.repoFiles = repoFiles;
			material.fileTree = [...repoFiles.keys()].slice(0, MAX_TREE_ENTRIES);
			material.docFiles = selectFromRepoFiles(
				repoFiles,
				isDocPath,
				MAX_DOC_FILES,
				MAX_DOC_FILE_BYTES
			);
			material.rootFiles = selectFromRepoFiles(
				repoFiles,
				isRootManifestPath,
				MAX_ROOT_FILES,
				MAX_ROOT_FILE_BYTES
			);
			return material;
		}
		onWarning?.("Couldn't download the repo archive — using standard-depth material instead.");
	}

	material.fileTree = await fetchFileTree(owner, repo, branch);
	const docPaths = (material.fileTree ?? []).filter(isDocPath).slice(0, MAX_DOC_FILES);
	material.docFiles = await fetchRawFiles(owner, repo, branch, docPaths, MAX_DOC_FILE_BYTES);

	if (scanDepth !== 'quick') {
		const rootPaths = (material.fileTree ?? []).filter(isRootManifestPath).slice(0, MAX_ROOT_FILES);
		material.rootFiles = await fetchRawFiles(owner, repo, branch, rootPaths, MAX_ROOT_FILE_BYTES);
	}

	return material;
}

// The repo's own docs beyond the README: root-level .md files (CONTRIBUTING,
// USAGE, FAQ, …) and anything under docs/. Changelogs and licenses are
// excluded — long, and useless for writing docs pages.
function isDocPath(path) {
	if (!/\.(md|mdx)$/i.test(path)) {
		return false;
	}
	if (
		/(^|\/)(readme|changelog|changes|history|license|licence|notice|code_of_conduct|security)[^/]*$/i.test(
			path
		)
	) {
		return false;
	}
	const segments = path.split('/');
	return (
		segments.length === 1 ||
		segments[0] === 'docs' ||
		segments[0] === 'doc' ||
		segments[0] === 'content' ||
		segments[0] === '.github'
	);
}

function isRootManifestPath(path) {
	if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(path)) {
		return true;
	}
	return !path.includes('/') && ROOT_MANIFEST_CANDIDATES.has(path);
}

async function fetchRawFiles(owner, repo, branch, paths, maxBytes) {
	const results = await Promise.all(
		paths.map(async (path) => {
			const content = await fetchRawFile(owner, repo, branch, [path]);
			return content ? { path, content: truncate(content, maxBytes) } : null;
		})
	);
	return results.filter(Boolean);
}

function selectFromRepoFiles(repoFiles, predicate, maxFiles, maxBytes) {
	const selected = [];
	for (const [path, content] of repoFiles) {
		if (!predicate(path)) {
			continue;
		}
		selected.push({ path, content: truncate(content, maxBytes) });
		if (selected.length >= maxFiles) {
			break;
		}
	}
	return selected;
}

// One request for the entire repo, from codeload rather than the REST API
// (see gatherScanMaterial for why). Returns a Map of repo-relative path ->
// file text for every text file worth indexing, or null on any failure.
async function downloadRepoTarball(owner, repo, branch) {
	let compressed;
	try {
		const res = await fetch(`https://codeload.github.com/${owner}/${repo}/tar.gz/${branch}`, {
			signal: AbortSignal.timeout(120_000)
		});
		if (!res.ok) {
			return null;
		}
		const declaredLength = Number(res.headers.get('content-length') ?? 0);
		if (declaredLength > MAX_TARBALL_BYTES) {
			return null;
		}
		compressed = Buffer.from(await res.arrayBuffer());
	} catch {
		return null;
	}
	if (compressed.length > MAX_TARBALL_BYTES) {
		return null;
	}

	try {
		return parseTarball(gunzipSync(compressed));
	} catch {
		return null;
	}
}

// Minimal tar reader instead of a dependency: entries are 512-byte headers
// followed by size-padded data. Handles ustar name+prefix and GNU 'L'
// longname entries, which covers what codeload produces; pax overrides for
// >255-char paths are rare enough to just let those files be skipped.
function parseTarball(tar) {
	const files = new Map();
	let storedBytes = 0;
	let offset = 0;
	let longName = null;

	while (offset + 512 <= tar.length) {
		const header = tar.subarray(offset, offset + 512);
		offset += 512;
		if (header.every((byte) => byte === 0)) {
			break;
		}

		const size = parseInt(header.toString('ascii', 124, 136).replace(/\0/g, '').trim(), 8) || 0;
		const typeflag = String.fromCharCode(header[156]);
		const data = tar.subarray(offset, offset + size);
		offset += size + ((512 - (size % 512)) % 512);

		if (typeflag === 'L') {
			longName = data.toString('utf8').replace(/\0+$/, '');
			continue;
		}

		const rawName = longName ?? readTarHeaderName(header);
		longName = null;
		if (typeflag !== '0' && typeflag !== '\0') {
			continue;
		}

		// codeload nests everything under a "<repo>-<ref>/" top directory.
		const path = rawName.split('/').slice(1).join('/');
		if (!path || !isStorableRepoFile(path, size)) {
			continue;
		}
		if (storedBytes + size > MAX_STORED_TOTAL_BYTES) {
			continue;
		}
		files.set(path, data.toString('utf8'));
		storedBytes += size;
	}

	return files;
}

function readTarHeaderName(header) {
	const name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
	const prefix = header.toString('utf8', 345, 500).replace(/\0.*$/, '');
	return prefix ? `${prefix}/${name}` : name;
}

function isStorableRepoFile(path, size) {
	if (size === 0 || size > MAX_STORED_FILE_BYTES) {
		return false;
	}
	if (isNoisyPath(path)) {
		return false;
	}
	const filename = path.split('/').pop().toLowerCase();
	if (EXTENSIONLESS_TEXT_FILES.has(filename)) {
		return true;
	}
	const dot = filename.lastIndexOf('.');
	return dot > 0 && TEXT_FILE_EXTENSIONS.has(filename.slice(dot));
}

export function generateHeuristicPages(repoContext) {
	if (!repoContext?.readme) {
		return [];
	}

	const body = stripBadgeRows(repoContext.readme);
	const sections = splitOnH2(body);
	const preamble = sections[0];
	const h2Sections = sections.slice(1);

	const introTitle = repoContext.name ? titleCase(repoContext.name) : 'Introduction';
	const introContent = stripLeadingH1(preamble.body) || `# ${introTitle}`;
	const introPage = {
		slug: 'introduction',
		title: introTitle,
		description: repoContext.description ?? firstSentence(preamble.body) ?? '',
		content: introContent
	};

	if (h2Sections.length === 0) {
		return [introPage];
	}

	const pages = [introPage];
	for (const section of h2Sections) {
		pages.push({
			slug: kebabCase(section.heading),
			title: section.heading,
			description: firstSentence(section.body) ?? '',
			content: section.body
		});
	}

	return dedupeSlugs(pages);
}

function stripBadgeRows(markdown) {
	return markdown
		.split(/\r?\n/)
		.filter((line) => {
			const trimmed = line.trim();
			if (!trimmed) {
				return true;
			}
			const withoutBadges = trimmed
				.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)|!\[[^\]]*\]\([^)]*\)/g, '')
				.trim();
			return withoutBadges !== '';
		})
		.join('\n');
}

function stripLeadingH1(text) {
	const lines = text.split(/\r?\n/);
	let i = 0;
	while (i < lines.length && lines[i].trim() === '') {
		i++;
	}
	if (i < lines.length && /^#\s+/.test(lines[i])) {
		lines.splice(i, 1);
	}
	return lines.join('\n').trim();
}

function splitOnH2(markdown) {
	const lines = markdown.split(/\r?\n/);
	const sections = [{ heading: null, bodyLines: [] }];

	for (const line of lines) {
		const match = line.match(/^##\s+(.+?)\s*$/);
		if (match) {
			sections.push({ heading: match[1], bodyLines: [] });
		} else {
			sections[sections.length - 1].bodyLines.push(line);
		}
	}

	return sections.map((s) => ({ heading: s.heading, body: s.bodyLines.join('\n').trim() }));
}

function firstSentence(text) {
	if (!text) {
		return null;
	}
	const plain = text
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[#*_>-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!plain) {
		return null;
	}
	const match = plain.match(/^.{1,200}?[.!?](?:\s|$)/);
	const sentence = match ? match[0].trim() : plain.slice(0, 160).trim();
	return sentence || null;
}

function titleCase(text) {
	return text
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function kebabCase(text) {
	return (
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'section'
	);
}

function dedupeSlugs(pages) {
	const seen = new Map();
	return pages.map((page) => {
		const count = seen.get(page.slug) ?? 0;
		seen.set(page.slug, count + 1);
		return count === 0 ? page : { ...page, slug: `${page.slug}-${count + 1}` };
	});
}

const PROVIDER_KEY_CHECK = {
	openai: {
		url: 'https://api.openai.com/v1/models',
		headers: (key) => ({ authorization: `Bearer ${key}` })
	},
	openrouter: {
		url: 'https://openrouter.ai/api/v1/key',
		headers: (key) => ({ authorization: `Bearer ${key}` })
	},
	anthropic: {
		url: 'https://api.anthropic.com/v1/models',
		headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' })
	}
};

// A models-list (or, for OpenRouter, key-info) request costs no tokens on
// any provider and needs the same auth header a real analysis call does, so
// it doubles as a cheap key check before spending the user's quota on the
// actual generation request. OpenRouter's /v1/models is public and would
// return 200 for literally any key (or none), so it uses /v1/key instead —
// the one endpoint of the three that's actually gated on the key being real.
export async function validateApiKey(provider, apiKey) {
	const check = PROVIDER_KEY_CHECK[provider] ?? PROVIDER_KEY_CHECK.anthropic;
	try {
		const res = await fetch(check.url, {
			headers: check.headers(apiKey),
			signal: AbortSignal.timeout(10_000)
		});
		return res.ok;
	} catch {
		return false;
	}
}

// Every provider ships new models faster than a hardcoded catalog can track
// (see FALLBACK_MODELS above) — asking the provider's own API for what it
// currently has is the only way this stays correct. Returns null on any
// failure so the caller can fall back to FALLBACK_MODELS; never throws.
export async function fetchAvailableModels(provider, apiKey) {
	try {
		if (provider === 'openai') {
			const res = await fetch('https://api.openai.com/v1/models', {
				headers: { authorization: `Bearer ${apiKey}` },
				signal: AbortSignal.timeout(15_000)
			});
			if (!res.ok) return null;
			const data = await res.json();
			return (data.data ?? [])
				.filter((m) => OPENAI_CHAT_MODEL_PATTERN.test(m.id))
				.sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
				.map((m) => ({ id: m.id }));
		}

		if (provider === 'openrouter') {
			const res = await fetch('https://openrouter.ai/api/v1/models', {
				headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
				signal: AbortSignal.timeout(15_000)
			});
			if (!res.ok) return null;
			const data = await res.json();
			return (data.data ?? []).map((m) => ({ id: m.id, name: m.name }));
		}

		const res = await fetch('https://api.anthropic.com/v1/models', {
			headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
			signal: AbortSignal.timeout(15_000)
		});
		if (!res.ok) return null;
		const data = await res.json();
		return (data.data ?? [])
			.slice()
			.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
			.map((m) => ({ id: m.id, name: m.display_name }));
	} catch {
		return null;
	}
}

const SYSTEM_PROMPT = `You are a senior technical writer generating documentation pages for a docs site scaffolded from an existing GitHub repository. Ground every claim in the provided repository material (README, docs, config files, source files) — never invent features, commands, options, or configuration the material does not show. Write clear, practical Markdown. Follow the output format instructions in each request exactly.`;

// No request timeout on generation calls, deliberately: they pair with
// whatever model the user picked (including the slowest one on any given
// provider) — there's no fixed duration that's "too long" for a real,
// in-progress generation, only a wrong guess that aborts (and burns the
// user's quota on) a request that was about to succeed. Ctrl+C during the
// spinner still cancels immediately, same as any other prompt in this CLI.
//
// Quick scan is one call that returns every page as JSON. Standard and deep
// are two-phase: a small JSON plan call, then one plain-markdown call per
// page — a failed page is skipped individually instead of discarding the
// whole analysis, and no response is large enough to hit its token budget.
export async function generateLlmPages(
	repoContext,
	provider,
	apiKey,
	model,
	scanDepth,
	onWarning,
	onProgress
) {
	if (!apiKey) {
		return null;
	}

	const resolvedModel = model || DEFAULT_MODEL[provider] || DEFAULT_MODEL.anthropic;
	const maxPages = SCAN_DEPTH_MAX_PAGES[scanDepth] ?? SCAN_DEPTH_MAX_PAGES.standard;

	if (scanDepth === 'quick') {
		let rawText;
		try {
			rawText = await callLlm(provider, apiKey, resolvedModel, buildQuickPrompt(repoContext), {
				maxTokens: QUICK_SCAN_MAX_TOKENS,
				json: true
			});
		} catch (error) {
			onWarning?.(`${provider} request failed: ${error.message}`);
			return null;
		}

		const result = parseAndValidateLlmOutput(rawText, maxPages);
		if (result.error) {
			onWarning?.(
				`AI response was not valid (${result.error}) — falling back to heuristic analysis`
			);
			return null;
		}
		return result.pages;
	}

	onProgress?.('Planning the docs structure');
	let planText;
	try {
		planText = await callLlm(
			provider,
			apiKey,
			resolvedModel,
			buildPlanPrompt(repoContext, scanDepth),
			{ maxTokens: PLAN_MAX_TOKENS, json: true }
		);
	} catch (error) {
		onWarning?.(`${provider} request failed while planning pages: ${error.message}`);
		return null;
	}

	const plan = parseAndValidatePlan(planText, maxPages);
	if (plan.error) {
		onWarning?.(`AI page plan was not valid (${plan.error}) — falling back to heuristic analysis`);
		return null;
	}

	const pages = [];
	const failures = [];
	for (const [index, entry] of plan.pages.entries()) {
		onProgress?.(`Writing "${entry.title}" (${index + 1}/${plan.pages.length})`);
		try {
			const rawPage = await callLlm(
				provider,
				apiKey,
				resolvedModel,
				buildPagePrompt(repoContext, entry),
				{ maxTokens: PAGE_MAX_TOKENS, json: false }
			);
			const content = cleanPageMarkdown(rawPage);
			if (!content) {
				throw new Error('empty page body');
			}
			pages.push({
				slug: kebabCase(entry.slug),
				title: entry.title,
				description: entry.description,
				content
			});
		} catch (error) {
			failures.push(`"${entry.title}" (${error.message})`);
		}
	}

	if (pages.length === 0) {
		onWarning?.(
			`AI page generation failed for every planned page — falling back to heuristic analysis. Last error: ${failures[failures.length - 1] ?? 'unknown'}`
		);
		return null;
	}
	if (failures.length > 0) {
		onWarning?.(
			`${failures.length} of ${plan.pages.length} planned pages failed and were skipped: ${failures.join(', ')}`
		);
	}
	return dedupeSlugs(pages);
}

function callLlm(provider, apiKey, model, prompt, options) {
	if (provider === 'openai') {
		return callOpenAI(apiKey, prompt, model, options);
	}
	if (provider === 'openrouter') {
		return callOpenRouter(apiKey, prompt, model, options);
	}
	return callAnthropic(apiKey, prompt, model, options);
}

async function callAnthropic(apiKey, prompt, model, { maxTokens }) {
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model,
			max_tokens: maxTokens,
			system: SYSTEM_PROMPT,
			messages: [{ role: 'user', content: prompt }]
		})
	});

	if (!res.ok) {
		throw new Error(`Anthropic API returned ${res.status}`);
	}

	const data = await res.json();
	if (data.stop_reason === 'max_tokens') {
		throw new Error('response hit the token limit and was truncated');
	}
	const text = data.content?.find((block) => block.type === 'text')?.text;
	if (!text) {
		throw new Error('Anthropic response had no text content');
	}
	return text;
}

async function callOpenAI(apiKey, prompt, model, { maxTokens, json }) {
	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			max_tokens: maxTokens,
			...(json ? { response_format: { type: 'json_object' } } : {}),
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: prompt }
			]
		})
	});

	if (!res.ok) {
		throw new Error(`OpenAI API returned ${res.status}`);
	}

	const data = await res.json();
	if (data.choices?.[0]?.finish_reason === 'length') {
		throw new Error('response hit the token limit and was truncated');
	}
	const text = data.choices?.[0]?.message?.content;
	if (!text) {
		throw new Error('OpenAI response had no message content');
	}
	return text;
}

// OpenRouter proxies to whatever backend the chosen model actually runs on
// (Anthropic, Google, open-weight models, etc.), most of which don't support
// OpenAI's response_format: json_object — so unlike callOpenAI, this relies
// on the prompt's own JSON instructions, same as callAnthropic.
async function callOpenRouter(apiKey, prompt, model, { maxTokens }) {
	const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${apiKey}`,
			'HTTP-Referer': 'https://svocs.dev',
			'X-Title': 'create-svocs-docs'
		},
		body: JSON.stringify({
			model,
			max_tokens: maxTokens,
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: prompt }
			]
		})
	});

	if (!res.ok) {
		throw new Error(`OpenRouter API returned ${res.status}`);
	}

	const data = await res.json();
	if (data.choices?.[0]?.finish_reason === 'length') {
		throw new Error('response hit the token limit and was truncated');
	}
	const text = data.choices?.[0]?.message?.content;
	if (!text) {
		throw new Error('OpenRouter response had no message content');
	}
	return text;
}

// Renders the gathered repo material as prompt sections — the same block
// feeds the quick-scan call, the plan call, and every page call, so the
// model always writes from identical ground truth.
function renderRepoMaterial(repoContext, { includeTree = false } = {}) {
	const parts = [
		`Project: ${repoContext.name}${repoContext.description ? ` — ${repoContext.description}` : ''}`
	];

	if (repoContext.packageJson) {
		const pkg = repoContext.packageJson;
		parts.push(
			`package.json:\n${JSON.stringify(
				{ name: pkg.name, description: pkg.description, scripts: pkg.scripts, bin: pkg.bin },
				null,
				2
			)}`
		);
	}

	parts.push(`README:\n"""\n${repoContext.readme ?? '(no README found)'}\n"""`);

	for (const file of [...(repoContext.docFiles ?? []), ...(repoContext.rootFiles ?? [])]) {
		parts.push(`${file.path}:\n"""\n${file.content}\n"""`);
	}

	if (includeTree && repoContext.fileTree?.length) {
		parts.push(
			`File tree (${repoContext.fileTree.length} files, build artifacts and lockfiles filtered out):\n${repoContext.fileTree.join('\n')}`
		);
	}

	return parts.join('\n\n');
}

function buildQuickPrompt(repoContext) {
	return `Generate baseline documentation pages from the repository material below.

${renderRepoMaterial(repoContext)}

Produce ONLY a single JSON object (no markdown code fences, no commentary) of this exact shape:
{"pages": [{"slug": "kebab-case-slug", "title": "Page Title", "description": "One sentence summary.", "content": "Markdown body, no frontmatter."}]}

Rules:
- 1 to ${SCAN_DEPTH_MAX_PAGES.quick} pages. Favor brevity over coverage: a single overview/introduction page, plus at most 2 more and only if the material clearly describes genuinely separate major topics (e.g. installation vs usage). Summarize rather than reproduce the README in full.
- The first page must be a general overview/introduction to the project.
- slugs must be unique, lowercase, kebab-case.
- content must be plain Markdown with no YAML frontmatter and no top-level "# Title" heading (the page title is rendered separately).
- Output must be valid JSON and nothing else.`;
}

function buildPlanPrompt(repoContext, scanDepth) {
	const maxPages = SCAN_DEPTH_MAX_PAGES[scanDepth] ?? SCAN_DEPTH_MAX_PAGES.standard;
	const deep = scanDepth === 'deep';

	return `Plan the page structure for a docs site generated from the repository material below. Do not write the pages yet — only the plan.

${renderRepoMaterial(repoContext, { includeTree: true })}

Produce ONLY a single JSON object (no markdown code fences, no commentary) of this exact shape:
{"pages": [{"slug": "kebab-case-slug", "title": "Page Title", "description": "One sentence summary.", "outline": "2-4 sentences on what this page should cover.", "sources": ["path/from/file/tree"]}]}

Rules:
- 1 to ${maxPages} pages, each covering one genuinely distinct topic the material supports (installation, usage, configuration${deep ? ', API/CLI reference, examples, architecture, contributing' : ', etc.'}) — do not invent topics the material doesn't mention.
- The first page must be a general overview/introduction to the project.
${
	deep
		? `- "sources" lists up to ${MAX_SOURCES_PER_PAGE} file-tree paths whose contents that page should be written from — pick the files most relevant to each topic (e.g. the CLI entry point for a CLI reference page).`
		: '- "sources" may be an empty array; all of the material above is provided again when each page is written.'
}
- slugs must be unique, lowercase, kebab-case.
- Output must be valid JSON and nothing else.`;
}

function buildPagePrompt(repoContext, entry) {
	const sourceSections = entry.sources
		.map((path) => {
			const content = repoContext.repoFiles?.get(path);
			return content ? `${path}:\n"""\n${truncate(content, MAX_SOURCE_FILE_BYTES)}\n"""` : null;
		})
		.filter(Boolean)
		.join('\n\n');

	return `Write one documentation page for a docs site generated from the repository material below.

${renderRepoMaterial(repoContext)}${sourceSections ? `\n\nSource files selected for this page:\n\n${sourceSections}` : ''}

Page to write:
- Title: ${entry.title}
- Purpose: ${entry.description || '(no description)'}${entry.outline ? `\n- Outline: ${entry.outline}` : ''}

Rules:
- Output ONLY the Markdown body of this page — no JSON, no code fences wrapping the whole document, no commentary before or after.
- No YAML frontmatter and no top-level "# Title" heading (the page title is rendered separately).
- Cover only this page's topic; other pages in the site cover the rest.
- Ground everything in the material above — never invent features, commands, or configuration.`;
}

function extractJsonObject(rawText) {
	const jsonMatch = rawText.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		return { error: 'no JSON object found in the response' };
	}
	try {
		return { value: JSON.parse(jsonMatch[0]) };
	} catch {
		return { error: "the response's JSON did not parse" };
	}
}

// Both validators clamp an over-long pages array to the tier's budget
// instead of rejecting it — a model that returns 9 good pages against a
// budget of 8 should lose one page, not the whole analysis. (The previous
// hard cap rejected outright, and sat at 8 while the deep prompt asked for
// up to 12 — every faithful 9-to-12-page deep scan was thrown away.)
function parseAndValidateLlmOutput(rawText, maxPages) {
	const { value: parsed, error } = extractJsonObject(rawText);
	if (error) {
		return { error };
	}

	if (!Array.isArray(parsed?.pages) || parsed.pages.length === 0) {
		return { error: 'the response had no "pages" array' };
	}

	const pages = [];
	for (const page of parsed.pages.slice(0, maxPages)) {
		if (
			typeof page?.slug !== 'string' ||
			typeof page?.title !== 'string' ||
			typeof page?.content !== 'string' ||
			!page.slug.trim() ||
			!page.title.trim() ||
			!page.content.trim()
		) {
			return { error: 'a page was missing its slug, title, or content' };
		}
		pages.push({
			slug: kebabCase(page.slug),
			title: page.title.trim(),
			description: typeof page.description === 'string' ? page.description.trim() : '',
			content: page.content.trim()
		});
	}

	return { pages: dedupeSlugs(pages) };
}

function parseAndValidatePlan(rawText, maxPages) {
	const { value: parsed, error } = extractJsonObject(rawText);
	if (error) {
		return { error };
	}

	if (!Array.isArray(parsed?.pages) || parsed.pages.length === 0) {
		return { error: 'the plan had no "pages" array' };
	}

	const pages = [];
	for (const entry of parsed.pages.slice(0, maxPages)) {
		if (
			typeof entry?.slug !== 'string' ||
			typeof entry?.title !== 'string' ||
			!entry.slug.trim() ||
			!entry.title.trim()
		) {
			return { error: 'a planned page was missing its slug or title' };
		}
		pages.push({
			slug: entry.slug.trim(),
			title: entry.title.trim(),
			description: typeof entry.description === 'string' ? entry.description.trim() : '',
			outline: typeof entry.outline === 'string' ? entry.outline.trim() : '',
			sources: Array.isArray(entry.sources)
				? entry.sources.filter((s) => typeof s === 'string').slice(0, MAX_SOURCES_PER_PAGE)
				: []
		});
	}

	return { pages };
}

// Page calls return bare markdown, but models sometimes wrap the whole body
// in a code fence or lead with the H1 they were told to omit — both are
// deterministic to strip, so strip them rather than fail the page.
function cleanPageMarkdown(rawText) {
	let text = rawText.trim();
	const fenced = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
	if (fenced) {
		text = fenced[1].trim();
	}
	return stripLeadingH1(text).trim();
}

// Every starter page the template ships, so a repo-analysis scaffold ends up
// entirely about the analyzed repo — no leftover generic "About SVOCS" /
// "Theming" / "Deployment" placeholders sitting alongside real generated
// content. `deployment` is a directory (index + cloudflare-pages +
// github-pages), not a single file, so it gets its own removal pass below.
const REPLACED_CONTENT_KEYS = new Set([
	'getting-started-heading',
	'introduction',
	'getting-started',
	'guides-heading',
	'writing-content',
	'components',
	'ai',
	'configuration-heading',
	'theming',
	'navigation',
	'search',
	'more-heading',
	'deployment',
	'about'
]);
const REPLACED_FILE_SLUGS = [
	'introduction',
	'getting-started',
	'writing-content',
	'components',
	'ai',
	'theming',
	'navigation',
	'search',
	'about'
];
const REPLACED_DIR_SLUGS = ['deployment'];

export function writeGeneratedPages(targetDir, pages) {
	if (!pages || pages.length === 0) {
		return;
	}

	const contentDir = join(targetDir, 'content');
	const normalized = pages.map((page, index) => ({
		...page,
		slug: index === 0 ? 'introduction' : page.slug
	}));

	for (const slug of REPLACED_FILE_SLUGS) {
		// components ships as .svx (an interactive demo page), everything
		// else as .md — try both rather than hardcode which slug uses which.
		rmIfExists(join(contentDir, `${slug}.md`));
		rmIfExists(join(contentDir, `${slug}.svx`));
		rmIfExists(join(contentDir, `${slug}.meta.json`));
	}
	for (const slug of REPLACED_DIR_SLUGS) {
		rmIfExists(join(contentDir, slug), { recursive: true });
	}

	normalized.forEach((page, index) => {
		writeFileSync(
			join(contentDir, `${page.slug}.md`),
			`${normalizeMarkdownSpacing(page.content).trim()}\n`
		);
		writeFileSync(join(contentDir, `${page.slug}.meta.json`), formatPageMeta(page, index + 1));
	});

	rewriteRootMeta(
		contentDir,
		normalized.map((p) => p.slug)
	);
}

// Hand-formatted rather than JSON.stringify(..., null, '\t') so the output
// matches this project's Prettier config exactly (short arrays collapse onto
// one line; JSON.stringify always expands them) — otherwise a freshly
// scaffolded project fails `bun run lint` immediately on its own generated
// content.
function formatPageMeta(page, order) {
	const lines = ['{', `\t"title": ${JSON.stringify(page.title)},`];
	if (page.description) {
		lines.push(`\t"description": ${JSON.stringify(page.description)},`);
	}
	lines.push(`\t"order": ${order},`, '\t"tags": ["guide"]', '}');
	return `${lines.join('\n')}\n`;
}

// Prettier requires a blank line between a paragraph and an adjacent list or
// heading — CommonMark allows either, but heuristic-split README sections
// (and especially LLM output, which isn't reliably consistent about this)
// can omit it, which fails `bun run lint` in the scaffolded project the
// moment it's generated. Deterministically fixing spacing here means every
// path (heuristic and LLM) always produces already-formatted markdown,
// rather than depending on a prompt instruction the model might not follow.
function normalizeMarkdownSpacing(content) {
	const lines = content.split(/\r?\n/);
	const isListItem = (line) => /^\s*([-*+]|\d+[.)])\s+/.test(line);
	const isHeading = (line) => /^#{1,6}\s+/.test(line);

	const spaced = [];
	let inFence = false;
	for (const line of lines) {
		if (/^```/.test(line.trim())) {
			inFence = !inFence;
			spaced.push(line);
			continue;
		}
		if (!inFence && spaced.length > 0) {
			const prev = spaced[spaced.length - 1];
			const prevBlank = prev.trim() === '';
			const needsBlank =
				!prevBlank &&
				line.trim() !== '' &&
				((isListItem(line) !== isListItem(prev) && (isListItem(line) || isListItem(prev))) ||
					isHeading(line) ||
					isHeading(prev));
			if (needsBlank) {
				spaced.push('');
			}
		}
		spaced.push(line);
	}

	const collapsed = [];
	for (const line of spaced) {
		if (line.trim() === '' && collapsed[collapsed.length - 1]?.trim() === '') {
			continue;
		}
		collapsed.push(line);
	}

	return collapsed.join('\n');
}

function rmIfExists(path, options) {
	if (existsSync(path)) {
		rmSync(path, options);
	}
}

function rewriteRootMeta(contentDir, newSlugs) {
	const metaPath = join(contentDir, '_meta.json');
	const meta = JSON.parse(readFileSync(metaPath, 'utf8'));

	const kept = Object.entries(meta.items).filter(([key]) => !REPLACED_CONTENT_KEYS.has(key));
	const removedCount = Object.keys(meta.items).length - kept.length;
	const shift = newSlugs.length + 1 - removedCount;

	const items = {
		'docs-heading': { type: 'separator', title: 'Docs', order: 1 }
	};
	newSlugs.forEach((slug, index) => {
		items[slug] = { order: index + 2 };
	});
	for (const [key, value] of kept) {
		items[key] = { ...value, order: value.order + shift };
	}

	writeFileSync(metaPath, `${JSON.stringify({ items }, null, '\t')}\n`);
}
