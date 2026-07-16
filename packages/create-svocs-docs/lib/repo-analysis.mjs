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
const MAX_README_BYTES = 300_000;
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const OPENAI_MODEL = 'gpt-4o-mini';

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

export async function generateLlmPages(repoContext, provider, apiKey, onWarning) {
	if (!apiKey) {
		return null;
	}

	const prompt = buildAnalysisPrompt(repoContext);

	let rawText;
	try {
		rawText =
			provider === 'openai'
				? await callOpenAI(apiKey, prompt)
				: await callAnthropic(apiKey, prompt);
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

async function callAnthropic(apiKey, prompt) {
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: ANTHROPIC_MODEL,
			max_tokens: 4096,
			messages: [{ role: 'user', content: prompt }]
		}),
		signal: AbortSignal.timeout(30_000)
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

async function callOpenAI(apiKey, prompt) {
	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: OPENAI_MODEL,
			response_format: { type: 'json_object' },
			messages: [{ role: 'user', content: prompt }]
		}),
		signal: AbortSignal.timeout(30_000)
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

function buildAnalysisPrompt(repoContext) {
	const packageInfo = repoContext.packageJson
		? `package.json:\n${JSON.stringify(
				{ name: repoContext.packageJson.name, description: repoContext.packageJson.description },
				null,
				2
			)}`
		: '(no package.json found)';

	return `You are generating baseline documentation pages for a new docs site, based on an existing project's README.

Project: ${repoContext.name}${repoContext.description ? ` — ${repoContext.description}` : ''}

${packageInfo}

README:
"""
${repoContext.readme ?? '(no README found)'}
"""

Produce ONLY a single JSON object (no markdown code fences, no commentary) of this exact shape:
{"pages": [{"slug": "kebab-case-slug", "title": "Page Title", "description": "One sentence summary.", "content": "Markdown body, no frontmatter."}]}

Rules:
- 1 to 8 pages.
- The first page must be a general overview/introduction to the project.
- Each subsequent page should cover one genuinely distinct topic implied by the README (installation, usage, configuration, etc.) — don't invent features the README doesn't mention.
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

const REPLACED_CONTENT_KEYS = new Set([
	'getting-started-heading',
	'introduction',
	'getting-started',
	'guides-heading',
	'writing-content',
	'components',
	'ai'
]);
const REPLACED_FILE_SLUGS = [
	'introduction',
	'getting-started',
	'writing-content',
	'components',
	'ai'
];

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

function rmIfExists(path) {
	if (existsSync(path)) {
		rmSync(path);
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
