import { Document } from 'flexsearch';

export type FlexDoc = {
	id: string;
	url: string;
	title: string;
	excerpt: string;
	content: string;
};

/**
 * One shared config, imported by both the indexer and the client — required
 * because FlexSearch's exported chunks only re-import correctly against a
 * Document instance built from an identical config to the one that
 * exported them.
 */
export function createDocumentIndex(): Document<FlexDoc, false, false> {
	return new Document<FlexDoc>({
		document: {
			id: 'id',
			index: ['title', 'content'],
			store: ['title', 'url', 'excerpt']
		}
	});
}
