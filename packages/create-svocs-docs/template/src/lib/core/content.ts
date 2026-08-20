/**
 * Client-safe half of the content registry: shared types, display helpers,
 * and lazy per-page component loading. Everything that reads raw markdown
 * (summaries, TOC, search and llms documents) lives in $lib/server/content
 * so the source tree never ships to the browser.
 */
import type { Component } from 'svelte';
import { isReservedSource, toSlug } from './content-paths';

export type ContentModule = {
	default: Component;
	metadata?: {
		title?: string;
		description?: string;
		order?: number;
		tags?: string[];
		/** Name from the curated icon set ($lib/icons/icon-set.ts). */
		icon?: string;
		/** `draft: true` or `publish: false` excludes the page from the build. */
		draft?: boolean;
		publish?: boolean;
	};
};

export type MetaItemConfig = {
	title?: string;
	order?: number;
	/** Name from the curated icon set ($lib/icons/icon-set.ts). Wins over a
	 *  page's own frontmatter icon; see applyMetaFallback. */
	icon?: string;
	/** Separators are virtual sidebar headings with no backing file, so
	 *  `title` and `order` are required. */
	type?: 'separator';
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
	/** Last git commit date for the source file (YYYY-MM-DD), when known. */
	lastModified?: string;
	/** Name from the curated icon set ($lib/icons/icon-set.ts). */
	icon?: string;
	/** Repo-relative source path, e.g. `content/guides/index.md` — backs "Edit on GitHub". */
	sourcePath: string;
};

export type TocItem = {
	id: string;
	text: string;
	depth: 2 | 3;
};

/** Unstripped markdown source for llms.txt and the per-page .md route. */
export type LlmsDocument = {
	slug: string;
	url: string;
	title: string;
	description?: string;
	raw: string;
};

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

/** '2026-07-17' -> 'July 17, 2026'. Date-only, so no timezone drift. */
export function formatLastUpdated(isoDate: string): string {
	const [year, month, day] = isoDate.split('-').map(Number);
	return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// Lazy, so each page compiles to its own chunk and a visitor only downloads
// the page they're reading instead of the whole content tree.
const componentLoaders = import.meta.glob<ContentModule>('/content/**/*.{md,svx}');

const loaderBySlug = new Map<string, () => Promise<ContentModule>>();
for (const [filePath, load] of Object.entries(componentLoaders)) {
	if (!isReservedSource(filePath)) {
		loaderBySlug.set(toSlug(filePath), load);
	}
}

export async function loadDocComponent(slug: string): Promise<Component | null> {
	const load = loaderBySlug.get(slug);
	if (!load) {
		return null;
	}
	return (await load()).default;
}
