/**
 * Build-time content registry. Reads every markdown source once, derives
 * summaries / TOCs / search and llms documents from it, and memoizes the
 * result: content is immutable for the lifetime of a build, and several
 * loads and endpoints ask for the same data per page.
 *
 * Server-only (prerendered into data and endpoints) so raw markdown never
 * reaches the client bundle. Client code imports $lib/core/content instead.
 */
import GithubSlugger from 'github-slugger';
import contentDates from 'virtual:svocs-content-dates';
import type { SearchDocument } from '$lib/search/types';
import type {
	ContentModule,
	ContentSummary,
	LlmsDocument,
	MetaItemConfig,
	TocItem
} from '$lib/core/content';
import {
	CONTENT_PREFIX,
	EXTENSION_RE,
	isReservedSource,
	routeFromSlug,
	toSlug
} from '$lib/core/content-paths';
import { createObsidianResolver, transformObsidian } from '$lib/build/obsidian';

export type { ContentSummary, LlmsDocument, MetaItemConfig, TocItem } from '$lib/core/content';

type DirectoryMetaModule = {
	items?: Record<string, MetaItemConfig>;
};

type PageMetaModule = {
	title?: string;
	description?: string;
	order?: number;
	tags?: string[];
	icon?: string;
	draft?: boolean;
	publish?: boolean;
};

const contentModules = import.meta.glob<ContentModule>('/content/**/*.{md,svx}', {
	eager: true
});
const rawContentModules = import.meta.glob<string>('/content/**/*.{md,svx}', {
	eager: true,
	query: '?raw',
	import: 'default'
});
const directoryMetaModules = import.meta.glob<DirectoryMetaModule>('/content/**/_meta.json', {
	eager: true,
	import: 'default'
});
const pageMetaModules = import.meta.glob<PageMetaModule>('/content/**/*.meta.json', {
	eager: true,
	import: 'default'
});

function titleFromSlug(slug: string): string {
	const fallback = slug.split('/').pop() || 'home';
	return fallback
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function metaPathFromContentPath(filePath: string): string {
	return filePath.replace(EXTENSION_RE, '.meta.json');
}

/** Lines of `raw` with fenced code removed, for text-level passes. */
function proseLines(raw: string): string[] {
	const out: string[] = [];
	let inCodeFence = false;
	for (const line of raw.split(/\r?\n/)) {
		if (/^```/.test(line.trim())) {
			inCodeFence = !inCodeFence;
			continue;
		}
		if (!inCodeFence) {
			out.push(line);
		}
	}
	return out;
}

export function extractTocFromMarkdown(raw: string): TocItem[] {
	const toc: TocItem[] = [];
	// Same slugger rehype-slug uses, so TOC ids always match rendered heading
	// ids (including underscore handling and duplicate-heading suffixes).
	const slugger = new GithubSlugger();

	for (const line of proseLines(raw)) {
		const match = line.match(/^(#{2,3})\s+(.+)$/);
		if (!match) {
			continue;
		}

		const depth = match[1].length as 2 | 3;
		// Strip markdown link syntax: rehype-slug ids come from the rendered
		// text, so the slugger must see "Datadog", not "[Datadog](https://…)".
		const text = match[2].trim().replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
		const id = slugger.slug(text);

		if (id) {
			toc.push({ id, text, depth });
		}
	}

	return toc;
}

export function stripMarkdownToText(raw: string): string {
	return proseLines(stripSourceForExport(raw))
		.map((line) => line.replace(/[`*_#[\]()<>-]/g, ' '))
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function countWords(text: string): number {
	return text ? text.split(/\s+/).length : 0;
}

/**
 * Markdown as a reader or an AI tool should see it: without the YAML
 * frontmatter and without the `<script>` import block .svx pages need to
 * pull in components. Fenced code is left untouched.
 */
export function stripSourceForExport(raw: string): string {
	let out = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
	const lines = out.split(/\r?\n/);
	const kept: string[] = [];
	let inCodeFence = false;
	let inScript = false;
	for (const line of lines) {
		if (/^```/.test(line.trim())) {
			inCodeFence = !inCodeFence;
		}
		if (!inCodeFence && !inScript && /^<script(\s[^>]*)?>/.test(line.trim())) {
			inScript = !/<\/script>\s*$/.test(line.trim());
			continue;
		}
		if (inScript) {
			if (/<\/script>\s*$/.test(line.trim())) {
				inScript = false;
			}
			continue;
		}
		kept.push(line);
	}
	out = kept.join('\n').replace(/^\n+/, '');
	return out;
}

/** Directory path ('' for the content root) → that directory's `_meta.json` items. */
export function loadMetaByDirectory(): Map<string, Record<string, MetaItemConfig>> {
	const metaByDirectory = new Map<string, Record<string, MetaItemConfig>>();

	for (const [filePath, mod] of Object.entries(directoryMetaModules)) {
		const folder = filePath.slice(CONTENT_PREFIX.length).replace(/\/?_meta\.json$/, '');

		if (mod.items) {
			metaByDirectory.set(folder, mod.items);
		}
	}

	return metaByDirectory;
}

function applyMetaFallback(
	entry: Omit<ContentSummary, 'title' | 'order'> & { title?: string; order?: number },
	metaByDirectory: Map<string, Record<string, MetaItemConfig>>
): ContentSummary {
	const pieces = entry.slug.split('/');
	const fileName = pieces[pieces.length - 1] || 'index';
	const directory = pieces.slice(0, -1).join('/');
	const itemMeta = metaByDirectory.get(directory)?.[fileName];

	return {
		...entry,
		// _meta.json wins over the page's own frontmatter/sidecar so nav can
		// always be reordered centrally.
		title: itemMeta?.title || entry.title || titleFromSlug(entry.slug),
		order: itemMeta?.order ?? entry.order ?? 999,
		icon: itemMeta?.icon || entry.icon
	};
}

type Registry = {
	summaries: ContentSummary[];
	docs: ContentSummary[];
	entryBySlug: Map<string, ContentSummary>;
	rawBySlug: Map<string, string>;
	tocBySlug: Map<string, TocItem[]>;
};

let registry: Registry | undefined;
let resolver: ReturnType<typeof createObsidianResolver> | undefined;

function obsidianResolver() {
	return (resolver ??= createObsidianResolver());
}

function buildRegistry(): Registry {
	const metaByDirectory = loadMetaByDirectory();
	const summaries: ContentSummary[] = [];
	const rawBySlug = new Map<string, string>();
	const tocBySlug = new Map<string, TocItem[]>();

	for (const [filePath, mod] of Object.entries(contentModules)) {
		if (isReservedSource(filePath)) {
			continue;
		}

		const slug = toSlug(filePath);
		const sidecarMeta = pageMetaModules[metaPathFromContentPath(filePath)];
		// Obsidian-style drafts: `publish: false` or `draft: true` keeps a page
		// out of the build entirely (no route, no nav, no search, no llms.txt).
		const meta = { ...mod.metadata, ...sidecarMeta };
		if (meta.draft === true || meta.publish === false) {
			continue;
		}
		// Same Obsidian rewrites the build applies, so exports and search see
		// the page as rendered rather than as authored.
		const raw = transformObsidian(rawContentModules[filePath] ?? '', obsidianResolver());
		const wordCount = countWords(stripMarkdownToText(raw));

		rawBySlug.set(slug, raw);
		tocBySlug.set(slug, extractTocFromMarkdown(raw));
		summaries.push(
			applyMetaFallback(
				{
					slug,
					path: routeFromSlug(slug),
					title: sidecarMeta?.title ?? mod.metadata?.title,
					description: sidecarMeta?.description ?? mod.metadata?.description,
					order: sidecarMeta?.order ?? mod.metadata?.order,
					tags: sidecarMeta?.tags ?? mod.metadata?.tags ?? [],
					icon: sidecarMeta?.icon ?? mod.metadata?.icon,
					wordCount,
					readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
					lastModified: contentDates[filePath.slice(1)],
					sourcePath: filePath.slice(1)
				},
				metaByDirectory
			)
		);
	}

	summaries.sort((a, b) =>
		a.order !== b.order ? a.order - b.order : a.slug.localeCompare(b.slug)
	);

	const docs = summaries.filter((entry) => !entry.slug.startsWith('blog/'));

	return {
		summaries,
		docs,
		entryBySlug: new Map(docs.map((entry) => [entry.slug, entry])),
		rawBySlug,
		tocBySlug
	};
}

function getRegistry(): Registry {
	return (registry ??= buildRegistry());
}

export function getAllContentSummaries(): ContentSummary[] {
	return getRegistry().summaries;
}

export function getDocsEntries(): ContentSummary[] {
	return getRegistry().docs;
}

export function getDocEntryBySlug(slugParts: string[]): ContentSummary | null {
	return getRegistry().entryBySlug.get(slugParts.join('/')) ?? null;
}

export function getDocTocBySlug(slugParts: string[]): TocItem[] {
	return getRegistry().tocBySlug.get(slugParts.join('/')) ?? [];
}

/** Export-ready markdown for one page — backs the /docs/*.md route. */
export function getRawMarkdownBySlug(slugParts: string[]): string | null {
	const raw = getRegistry().rawBySlug.get(slugParts.join('/'));
	return raw === undefined ? null : stripSourceForExport(raw);
}

/** Backs llms.txt and llms-full.txt — page source, unlike search documents. */
export function getAllLlmsDocuments(): LlmsDocument[] {
	const { docs, rawBySlug } = getRegistry();
	return docs
		.map((entry) => ({
			slug: entry.slug,
			url: entry.path,
			title: entry.title,
			description: entry.description,
			raw: stripSourceForExport(rawBySlug.get(entry.slug) ?? '')
		}))
		.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** The canonical source every search backend's indexer builds from. */
export function getAllSearchDocuments(): SearchDocument[] {
	const { docs, rawBySlug, tocBySlug } = getRegistry();
	return docs.map((entry) => ({
		id: entry.slug,
		url: entry.path,
		title: entry.title,
		description: entry.description,
		content: stripMarkdownToText(rawBySlug.get(entry.slug) ?? ''),
		headings: (tocBySlug.get(entry.slug) ?? []).map(({ id, text }) => ({ id, text }))
	}));
}
