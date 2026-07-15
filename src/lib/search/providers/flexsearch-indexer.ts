import { getAllSearchDocuments } from '$lib/core/content';
import { createDocumentIndex } from './flexsearch-config';

/** Build-time only — FlexSearch's export() is callback-based and multi-chunk
 *  (one call per internal data structure), so every {key, data} pair gets
 *  collected into one plain object the client can fetch as a single blob. */
export async function buildFlexSearchIndex(): Promise<Record<string, string>> {
	const index = createDocumentIndex();

	for (const doc of getAllSearchDocuments()) {
		index.add({
			id: doc.id,
			url: doc.url,
			title: doc.title,
			excerpt:
				doc.description ??
				(doc.content.length > 160 ? `${doc.content.slice(0, 160)}…` : doc.content),
			content: doc.content
		});
	}

	const chunks: Record<string, string> = {};
	await index.export(async (key, data) => {
		chunks[String(key)] = data;
	});

	return chunks;
}
