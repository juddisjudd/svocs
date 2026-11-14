/** A heading-level match inside a result page; `url` carries the heading's #anchor. */
export type SearchSection = {
	url: string;
	title: string;
	excerpt: string;
};

/** Normalized shape every backend's client maps its own results into. */
export type SearchResultItem = {
	id: string;
	url: string;
	title: string;
	excerpt: string;
	sections?: SearchSection[];
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
	/** The page's h2 and h3 sections; `id` is the heading anchor. */
	sections: { id: string; title: string; content: string }[];
};

export type SearchProviderId = 'pagefind' | 'orama' | 'flexsearch' | 'typesense' | 'chroma';
