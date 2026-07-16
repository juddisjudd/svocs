// Optional scaffolding step: analyze an existing GitHub repo and generate a
// baseline content/ tree from it instead of the generic starter pages.
//
// This is a strict, gracefully-degrading enhancement — every failure here
// (bad repo, rate limit, bad key, malformed AI output) falls back one tier
// (LLM -> heuristic -> untouched starter content) and nothing in this module
// throws past its own function or aborts the scaffold.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GITHUB_API = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';
const README_CANDIDATES = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];
const CONTRIBUTING_CANDIDATES = [
	'CONTRIBUTING.md',
	'contributing.md',
	'.github/CONTRIBUTING.md',
	'CONTRIBUTING.MD'
];
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
const SCAN_DEPTH_MAX_TOKENS = { quick: 2048, standard: 4096, deep: 8192 };

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

// Deep scan's only addition over the default fetch: the file tree (so the
// model can infer topics the README doesn't spell out) and CONTRIBUTING.md
// (so a "Contributing" page can be grounded in real content instead of
// invented). Both go through the same unauthenticated GitHub REST API the
// default fetch already uses — no token needed, same as fetchRepoContext.
export async function fetchDeepRepoContext(owner, repo, branch) {
	const [fileTree, contributingRaw] = await Promise.all([
		fetchFileTree(owner, repo, branch),
		fetchRawFile(owner, repo, branch, CONTRIBUTING_CANDIDATES)
	]);

	return {
		fileTree,
		contributing: contributingRaw
			? rewriteRelativeLinks(truncate(contributingRaw, MAX_README_BYTES), owner, repo, branch)
			: null
	};
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

// No request timeout here, deliberately: Deep Scan can ask for up to 8192
// output tokens, and pairs with whatever model the user picked (including
// the slowest one on any given provider) — there's no fixed duration that's
// "too long" for a real, in-progress generation, only a wrong guess that
// aborts (and burns the user's quota on) a request that was about to
// succeed. Ctrl+C during the spinner still cancels immediately, same as any
// other prompt in this CLI.
export async function generateLlmPages(repoContext, provider, apiKey, model, scanDepth, onWarning) {
	if (!apiKey) {
		return null;
	}

	const resolvedModel = model || DEFAULT_MODEL[provider] || DEFAULT_MODEL.anthropic;
	const maxTokens = SCAN_DEPTH_MAX_TOKENS[scanDepth] ?? SCAN_DEPTH_MAX_TOKENS.standard;
	const prompt = buildAnalysisPrompt(repoContext, scanDepth);

	let rawText;
	try {
		if (provider === 'openai') {
			rawText = await callOpenAI(apiKey, prompt, resolvedModel, maxTokens);
		} else if (provider === 'openrouter') {
			rawText = await callOpenRouter(apiKey, prompt, resolvedModel, maxTokens);
		} else {
			rawText = await callAnthropic(apiKey, prompt, resolvedModel, maxTokens);
		}
	} catch (error) {
		onWarning?.(`${provider} request failed: ${error.message}`);
		return null;
	}

	const pages = parseAndValidateLlmOutput(rawText);
	if (!pages) {
		onWarning?.('AI response was not valid — falling back to heuristic analysis');
	}
	return pages;
}

async function callAnthropic(apiKey, prompt, model, maxTokens) {
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
			messages: [{ role: 'user', content: prompt }]
		})
	});

	if (!res.ok) {
		throw new Error(`Anthropic API returned ${res.status}`);
	}

	const data = await res.json();
	const text = data.content?.[0]?.text;
	if (!text) {
		throw new Error('Anthropic response had no text content');
	}
	return text;
}

async function callOpenAI(apiKey, prompt, model, maxTokens) {
	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			max_tokens: maxTokens,
			response_format: { type: 'json_object' },
			messages: [{ role: 'user', content: prompt }]
		})
	});

	if (!res.ok) {
		throw new Error(`OpenAI API returned ${res.status}`);
	}

	const data = await res.json();
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
async function callOpenRouter(apiKey, prompt, model, maxTokens) {
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
			messages: [{ role: 'user', content: prompt }]
		})
	});

	if (!res.ok) {
		throw new Error(`OpenRouter API returned ${res.status}`);
	}

	const data = await res.json();
	const text = data.choices?.[0]?.message?.content;
	if (!text) {
		throw new Error('OpenRouter response had no message content');
	}
	return text;
}

const SCAN_DEPTH_RULES = {
	quick: {
		pageBudget: '1 to 3',
		guidance:
			'Favor brevity over coverage: a single overview/introduction page, plus at most 2 more pages and only if the README clearly describes genuinely separate major topics (e.g. installation vs usage). Summarize rather than reproduce the README in full.'
	},
	standard: {
		pageBudget: '1 to 8',
		guidance:
			"Each subsequent page should cover one genuinely distinct topic implied by the README (installation, usage, configuration, etc.) — don't invent features the README doesn't mention."
	},
	deep: {
		pageBudget: '1 to 12',
		guidance:
			'Be thorough: cover every genuinely distinct topic the README, file tree, and CONTRIBUTING content imply (installation, usage, configuration, API/CLI reference, examples, architecture, contributing). Use the file tree only to infer what topics exist — e.g. a `cli/` directory implies a CLI reference page exists as a topic — never invent details about those topics beyond what the README, package.json, or CONTRIBUTING content actually state.'
	}
};

function buildAnalysisPrompt(repoContext, scanDepth = 'standard') {
	const tier = SCAN_DEPTH_RULES[scanDepth] ?? SCAN_DEPTH_RULES.standard;

	const packageInfo = repoContext.packageJson
		? `package.json:\n${JSON.stringify(
				{ name: repoContext.packageJson.name, description: repoContext.packageJson.description },
				null,
				2
			)}`
		: '(no package.json found)';

	const fileTreeSection = repoContext.fileTree?.length
		? `\n\nFile tree (${repoContext.fileTree.length} files, build artifacts and lockfiles filtered out):\n${repoContext.fileTree.join('\n')}`
		: '';
	const contributingSection = repoContext.contributing
		? `\n\nCONTRIBUTING:\n"""\n${repoContext.contributing}\n"""`
		: '';

	return `You are generating baseline documentation pages for a new docs site, based on an existing project's README.

Project: ${repoContext.name}${repoContext.description ? ` — ${repoContext.description}` : ''}

${packageInfo}

README:
"""
${repoContext.readme ?? '(no README found)'}
"""${fileTreeSection}${contributingSection}

Produce ONLY a single JSON object (no markdown code fences, no commentary) of this exact shape:
{"pages": [{"slug": "kebab-case-slug", "title": "Page Title", "description": "One sentence summary.", "content": "Markdown body, no frontmatter."}]}

Rules:
- ${tier.pageBudget} pages.
- The first page must be a general overview/introduction to the project.
- ${tier.guidance}
- slugs must be unique, lowercase, kebab-case.
- content must be plain Markdown with no YAML frontmatter and no top-level "# Title" heading (the page title is rendered separately).
- Output must be valid JSON and nothing else.`;
}

function parseAndValidateLlmOutput(rawText) {
	const jsonMatch = rawText.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		return null;
	}

	let parsed;
	try {
		parsed = JSON.parse(jsonMatch[0]);
	} catch {
		return null;
	}

	if (!Array.isArray(parsed?.pages) || parsed.pages.length === 0 || parsed.pages.length > 8) {
		return null;
	}

	const pages = [];
	for (const page of parsed.pages) {
		if (
			typeof page?.slug !== 'string' ||
			typeof page?.title !== 'string' ||
			typeof page?.content !== 'string' ||
			!page.slug.trim() ||
			!page.title.trim() ||
			!page.content.trim()
		) {
			return null;
		}
		pages.push({
			slug: kebabCase(page.slug),
			title: page.title.trim(),
			description: typeof page.description === 'string' ? page.description.trim() : '',
			content: page.content.trim()
		});
	}

	return dedupeSlugs(pages);
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
