import { defineEnvVars } from '@sveltejs/kit/env';

// The site is fully prerendered, so every variable is inlined at build time.
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	PUBLIC_SVOCS_SEARCH_PROVIDER: {
		public: true,
		static: true,
		description: 'Active search backend. vite.config.ts sets the default.',
		schema: (value) => value ?? 'pagefind'
	},
	PUBLIC_TYPESENSE_HOST: { public: true, static: true, schema: optional },
	PUBLIC_TYPESENSE_PORT: { public: true, static: true, schema: optional },
	PUBLIC_TYPESENSE_PROTOCOL: { public: true, static: true, schema: optional },
	PUBLIC_TYPESENSE_SEARCH_API_KEY: {
		public: true,
		static: true,
		description: 'Search-only key. Never put the admin key here.',
		schema: optional
	},
	PUBLIC_TYPESENSE_COLLECTION_NAME: { public: true, static: true, schema: optional },
	PUBLIC_CHROMA_HOST: { public: true, static: true, schema: optional },
	PUBLIC_CHROMA_PORT: { public: true, static: true, schema: optional },
	PUBLIC_CHROMA_SSL: { public: true, static: true, schema: optional },
	PUBLIC_CHROMA_TOKEN: { public: true, static: true, schema: optional },
	PUBLIC_CHROMA_COLLECTION_NAME: { public: true, static: true, schema: optional }
});
