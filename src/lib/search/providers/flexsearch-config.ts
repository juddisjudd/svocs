import { Document } from 'flexsearch';
import type { SearchRecord } from '../records';

/**
 * One shared config, imported by both the indexer and the client — required
 * because FlexSearch's exported chunks only re-import correctly against a
 * Document instance built from an identical config to the one that
 * exported them.
 */
export function createDocumentIndex(): Document<SearchRecord, false, false> {
	return new Document<SearchRecord>({
		document: {
			id: 'id',
			index: ['title', 'heading', 'content'],
			store: ['page', 'pageTitle', 'url', 'heading', 'content']
		}
	});
}
