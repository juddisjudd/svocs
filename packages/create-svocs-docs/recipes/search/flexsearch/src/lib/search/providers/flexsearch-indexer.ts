import { getAllSearchDocuments } from '#lib/server/content.js';
import { toSearchRecords } from '../records';
import { createDocumentIndex } from './flexsearch-config';

/** Build-time only — FlexSearch's export() is callback-based and multi-chunk
 *  (one call per internal data structure), so every {key, data} pair gets
 *  collected into one plain object the client can fetch as a single blob. */
export async function buildFlexSearchIndex(): Promise<Record<string, string>> {
	const index = createDocumentIndex();

	for (const record of getAllSearchDocuments().flatMap(toSearchRecords)) {
		index.add(record);
	}

	const chunks: Record<string, string> = {};
	await index.export(async (key, data) => {
		chunks[String(key)] = data;
	});

	return chunks;
}
