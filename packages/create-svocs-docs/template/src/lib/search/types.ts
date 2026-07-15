/** Normalized shape every backend's client maps its own results into. */
export type SearchResultItem = {
	id: string;
	url: string;
	title: string;
	excerpt: string;
};

/** What SearchDialog calls — one function, no backend-specific knowledge. */
export type SearchClient = {
	search(query: string): Promise<SearchResultItem[]>;
};

/** What every build-time indexer/sync script consumes as its source content. */
export type SearchDocument = {
	id: string;
	url: string;
	title: string;
	description?: string;
	content: string;
	headings: { id: string; text: string }[];
};

export type SearchProviderId = 'pagefind' | 'orama' | 'flexsearch' | 'typesense' | 'chroma';
