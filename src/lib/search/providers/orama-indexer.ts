import { getAllSearchDocuments } from '$lib/core/content';

export type OramaDoc = { id: string; url: string; title: string; content: string };

/**
 * Build-time only — ships the raw documents as JSON rather than a
 * pre-built, persisted Orama DB. @orama/plugin-data-persistence pulls in
 * `dpack`, which depends on Node's Transform streams and breaks at
 * runtime in the browser even when only the 'json' format is used (see
 * https://github.com/oramasearch/orama/issues/876) — building a fresh
 * in-memory index client-side from plain JSON avoids that dependency
 * entirely, and re-indexing a few dozen docs is trivial cost.
 */
export function buildOramaDocuments(): OramaDoc[] {
	return getAllSearchDocuments().map((doc) => ({
		id: doc.id,
		url: doc.url,
		title: doc.title,
		content: doc.content
	}));
}
