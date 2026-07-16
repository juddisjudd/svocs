import { readFileSync } from 'node:fs';
import { ChromaClient } from 'chromadb';
import type { SearchDocument } from '../../src/lib/search/types';

// Runs after `vite build`; reads the prerendered search-index.json off disk.
const docs: SearchDocument[] = JSON.parse(readFileSync('build/search-index.json', 'utf-8'));

const host = requireEnv('CHROMA_HOST');
const port = Number(process.env.CHROMA_PORT ?? '8000');
const ssl = process.env.CHROMA_SSL === 'true';
const token = requireEnv('CHROMA_ADMIN_TOKEN');
const collectionName = requireEnv('PUBLIC_CHROMA_COLLECTION_NAME');

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

async function main() {
	const client = new ChromaClient({
		host,
		port,
		ssl,
		headers: { Authorization: `Bearer ${token}` }
	});

	// Recreate rather than upsert so removed/renamed pages never leave stale
	// entries behind.
	try {
		await client.deleteCollection({ name: collectionName });
	} catch {
		// didn't exist yet — fine
	}

	const collection = await client.createCollection({ name: collectionName });

	await collection.add({
		ids: docs.map((doc) => doc.id),
		documents: docs.map((doc) => doc.content),
		metadatas: docs.map((doc) => ({
			url: doc.url,
			title: doc.title,
			description: doc.description ?? ''
		}))
	});

	console.log(`Synced ${docs.length} documents to Chroma collection "${collectionName}".`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
