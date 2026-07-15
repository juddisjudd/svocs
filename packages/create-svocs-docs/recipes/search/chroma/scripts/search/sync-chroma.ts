import { readFileSync } from 'node:fs';
import { ChromaClient } from 'chromadb';
import type { SearchDocument } from '../../src/lib/search/types';

// Runs AFTER `vite build` (see scripts/search/postbuild.mjs) — reads the
// already-prerendered search-index.json straight off disk, same as the
// Typesense sync script.
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

	// Recreate on every sync rather than upserting, so removed/renamed pages
	// never leave stale entries behind — a full rebuild is cheap at this
	// content size (see content/search/chroma.md for the security setup
	// this token needs: a write-scoped credential, never the one shipped
	// to the browser).
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
