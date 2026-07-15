import type { Component } from 'svelte';
import GithubSlugger from 'github-slugger';

type ContentModule = {
	default: Component;
	metadata?: {
		title?: string;
		description?: string;
		order?: number;
		tags?: string[];
	};
};

type DirectoryMetaModule = {
	items?: Record<string, { title?: string; order?: number }>;
};

type PageMetaModule = {
	title?: string;
	description?: string;
	order?: number;
	tags?: string[];
};

export type ContentSummary = {
	slug: string;
	path: string;
	title: string;
	description?: string;
	order: number;
	tags: string[];
	wordCount: number;
	readingTimeMinutes: number;
};

export type TocItem = {
	id: string;
	text: string;
	depth: 2 | 3;
};

const contentModules = import.meta.glob('/content/**/*.{md,svx}', { eager: true }) as Record<
	string,
	ContentModule
>;
const rawContentModules = import.meta.glob('/content/**/*.{md,svx}', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;
const directoryMetaModules = import.meta.glob('/content/**/_meta.json', {
	eager: true,
	import: 'default'
}) as Record<string, DirectoryMetaModule>;
const pageMetaModules = import.meta.glob('/content/**/*.meta.json', {
	eager: true,
	import: 'default'
}) as Record<string, PageMetaModule>;

const CONTENT_PREFIX = '/content/';
const EXTENSION_RE = /\.(md|svx)$/;

function toSlug(filePath: string): string {
	const relativePath = filePath.slice(CONTENT_PREFIX.length).replace(EXTENSION_RE, '');
	return relativePath === 'index' ? '' : relativePath.replace(/\/index$/, '');
}

function titleFromSlug(slug: string): string {
	const fallback = slug.split('/').pop() || 'home';
	return fallback
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function routeFromSlug(slug: string): string {
	return slug ? `/docs/${slug}` : '/docs';
}

function metaPathFromContentPath(filePath: string): string {
	return filePath.replace(EXTENSION_RE, '.meta.json');
}

function extractTocFromMarkdown(raw: string): TocItem[] {
	const lines = raw.split(/\r?\n/);
	const toc: TocItem[] = [];
	// Same slugger rehype-slug uses, so TOC ids always match rendered heading
	// ids (including underscore handling and duplicate-heading suffixes).
	const slugger = new GithubSlugger();
	let inCodeFence = false;

	for (const line of lines) {
		if (/^```/.test(line.trim())) {
			inCodeFence = !inCodeFence;
			continue;
		}

		if (inCodeFence) {
			continue;
		}

		const match = line.match(/^(#{2,3})\s+(.+)$/);
		if (!match) {
			continue;
		}

		const depth = match[1].length as 2 | 3;
		const text = match[2].trim();
		const id = slugger.slug(text);

		if (!id) {
			continue;
		}

		toc.push({ id, text, depth });
	}

	return toc;
}

function extractWordCount(raw: string): number {
	const lines = raw.split(/\r?\n/);
	let inCodeFence = false;
	let text = '';

	for (const line of lines) {
		if (/^```/.test(line.trim())) {
			inCodeFence = !inCodeFence;
			continue;
		}

		if (inCodeFence) {
			continue;
		}

		text += ` ${line.replace(/[`*_#[\]()<>-]/g, ' ')}`;
	}

	const words = text.trim().split(/\s+/).filter(Boolean);

	return words.length;
}

function loadMetaByDirectory(): Map<string, Record<string, { title?: string; order?: number }>> {
	const metaByDirectory = new Map<string, Record<string, { title?: string; order?: number }>>();

	for (const [filePath, mod] of Object.entries(directoryMetaModules)) {
		const folder = filePath
			.slice(CONTENT_PREFIX.length)
			.replace('/_meta.json', '')
			.replace(/^\.$/, '');

		if (mod.items) {
			metaByDirectory.set(folder, mod.items);
		}
	}

	return metaByDirectory;
}

function applyMetaFallback(
	entry: Omit<ContentSummary, 'title' | 'order' | 'wordCount' | 'readingTimeMinutes'> & {
		title?: string;
		order?: number;
		wordCount: number;
		readingTimeMinutes: number;
	},
	metaByDirectory: Map<string, Record<string, { title?: string; order?: number }>>
): ContentSummary {
	const pieces = entry.slug.split('/');
	const fileName = pieces[pieces.length - 1] || 'index';
	const directory = pieces.slice(0, -1).join('/');
	const directoryMeta = metaByDirectory.get(directory);
	const itemMeta = directoryMeta?.[fileName];

	return {
		...entry,
		title: entry.title || itemMeta?.title || titleFromSlug(entry.slug),
		order: entry.order ?? itemMeta?.order ?? 999
	};
}

export function getAllContentSummaries(): ContentSummary[] {
	const metaByDirectory = loadMetaByDirectory();
	const entries: ContentSummary[] = [];

	for (const [filePath, mod] of Object.entries(contentModules)) {
		if (filePath.endsWith('/_meta.md') || filePath.endsWith('/_meta.svx')) {
			continue;
		}

		const slug = toSlug(filePath);
		const sidecarMeta = pageMetaModules[metaPathFromContentPath(filePath)];
		const raw = rawContentModules[filePath] ?? '';
		const wordCount = extractWordCount(raw);
		const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

		const enriched = applyMetaFallback(
			{
				slug,
				path: routeFromSlug(slug),
				title: sidecarMeta?.title ?? mod.metadata?.title,
				description: sidecarMeta?.description ?? mod.metadata?.description,
				order: sidecarMeta?.order ?? mod.metadata?.order,
				tags: sidecarMeta?.tags ?? mod.metadata?.tags ?? [],
				wordCount,
				readingTimeMinutes
			},
			metaByDirectory
		);

		entries.push(enriched);
	}

	return entries.sort((a, b) => {
		if (a.order !== b.order) {
			return a.order - b.order;
		}

		return a.slug.localeCompare(b.slug);
	});
}

export function getDocsEntries(): ContentSummary[] {
	const entries = getAllContentSummaries();
	return entries.filter((entry) => !entry.slug.startsWith('blog/'));
}

export function getDocEntryBySlug(slugParts: string[]): ContentSummary | null {
	const slug = slugParts.join('/');
	const docsEntries = getDocsEntries();
	return docsEntries.find((entry) => entry.slug === slug) ?? null;
}

export function getDocComponentBySlug(slugParts: string[]): Component | null {
	const slug = slugParts.join('/');
	const targetPath = Object.keys(contentModules).find((path) => toSlug(path) === slug);

	if (!targetPath) {
		return null;
	}

	const mod = contentModules[targetPath];
	if (!mod || targetPath.endsWith('/_meta.md')) {
		return null;
	}

	return mod.default;
}

export function getDocTocBySlug(slugParts: string[]): TocItem[] {
	const slug = slugParts.join('/');
	const targetPath = Object.keys(rawContentModules).find((path) => toSlug(path) === slug);

	if (!targetPath) {
		return [];
	}

	const raw = rawContentModules[targetPath];
	if (!raw) {
		return [];
	}

	return extractTocFromMarkdown(raw);
}
