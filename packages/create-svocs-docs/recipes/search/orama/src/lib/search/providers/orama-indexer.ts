import { getAllSearchDocuments } from '#lib/server/content.js';
import { toSearchRecords, type SearchRecord } from '../records';

/**
 * Ships raw JSON, not a persisted Orama DB: @orama/plugin-data-persistence
 * breaks in the browser (https://github.com/oramasearch/orama/issues/876),
 * and re-indexing client-side is cheap.
 */
export function buildOramaDocuments(): SearchRecord[] {
	return getAllSearchDocuments().flatMap(toSearchRecords);
}
