import type { SearchDocument, SearchResultItem } from './types';

/** One record per page and one per section, for backends that index in the browser. */
export type SearchRecord = {
	id: string;
	page: string;
	pageTitle: string;
	url: string;
	title: string;
	heading: string;
	content: string;
};

const MAX_PAGES = 8;
const MAX_SECTIONS_PER_PAGE = 3;

// Section records leave `title` empty, so a page-title match never drags in every section of that page.
export function toSearchRecords(doc: SearchDocument): SearchRecord[] {
	const page = {
		id: doc.id,
		page: doc.id,
		pageTitle: doc.title,
		url: doc.url,
		title: doc.title,
		heading: '',
		content: [doc.description, doc.content].filter(Boolean).join(' ')
	};
	return [
		page,
		...doc.sections.map((section) => ({
			id: `${doc.id}#${section.id}`,
			page: doc.id,
			pageTitle: doc.title,
			url: `${doc.url}#${section.id}`,
			title: '',
			heading: section.title,
			content: section.content
		}))
	];
}

/** About `length` characters of `text` around the first query term it contains. */
export function excerptAround(text: string, query: string, length = 160): string {
	const lower = text.toLowerCase();
	const hits = query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.map((term) => lower.indexOf(term))
		.filter((index) => index >= 0);
	const first = hits.length > 0 ? Math.min(...hits) : 0;
	let start = Math.max(0, first - Math.floor(length / 4));
	if (start > 0) {
		const space = text.indexOf(' ', start);
		start = space >= 0 && space < first ? space + 1 : start;
	}
	const end = Math.min(text.length, start + length);
	return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

/** Ranked record hits folded into page results, each with its best-matching sections. */
export function groupRecords(hits: SearchRecord[], query: string): SearchResultItem[] {
	const pages = new Map<
		string,
		SearchResultItem & { sections: NonNullable<SearchResultItem['sections']> }
	>();
	for (const hit of hits) {
		let result = pages.get(hit.page);
		if (!result) {
			if (pages.size >= MAX_PAGES) {
				continue;
			}
			result = {
				id: hit.page,
				url: hit.url.split('#')[0],
				title: hit.pageTitle,
				excerpt: '',
				sections: []
			};
			pages.set(hit.page, result);
		}
		if (!hit.heading) {
			result.excerpt = excerptAround(hit.content, query);
		} else if (result.sections.length < MAX_SECTIONS_PER_PAGE) {
			result.sections.push({
				url: hit.url,
				title: hit.heading,
				excerpt: excerptAround(hit.content, query)
			});
		}
	}
	return [...pages.values()];
}
