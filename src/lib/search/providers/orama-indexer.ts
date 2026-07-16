import { getAllSearchDocuments } from '$lib/core/content';

export type OramaDoc = { id: string; url: string; title: string; content: string };

/**
 * Ships raw JSON, not a persisted Orama DB: @orama/plugin-data-persistence
 * breaks in the browser (https://github.com/oramasearch/orama/issues/876),
 * and re-indexing client-side is cheap.
 */
export function buildOramaDocuments(): OramaDoc[] {
	return getAllSearchDocuments().map((doc) => ({
		id: doc.id,
		url: doc.url,
		title: doc.title,
		content: doc.content
	}));
}
