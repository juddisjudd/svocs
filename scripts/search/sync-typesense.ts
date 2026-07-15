import { readFileSync } from 'node:fs';
import { Client } from 'typesense';
import type { SearchDocument } from '../../src/lib/search/types';

// Runs AFTER `vite build` (see scripts/search/postbuild.mjs), so this reads
// the already-prerendered search-index.json straight off disk — no need to
// re-parse content/ or resolve $lib aliases outside Vite's own build.
const docs: SearchDocument[] = JSON.parse(readFileSync('build/search-index.json', 'utf-8'));

const host = requireEnv('TYPESENSE_HOST');
const port = Number(process.env.TYPESENSE_PORT ?? '443');
const protocol = process.env.TYPESENSE_PROTOCOL ?? 'https';
const apiKey = requireEnv('TYPESENSE_ADMIN_API_KEY');
const collectionName = requireEnv('PUBLIC_TYPESENSE_COLLECTION_NAME');

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

async function main() {
	const client = new Client({
		apiKey,
		nodes: [{ host, port, protocol }],
		connectionTimeoutSeconds: 10
	});

	const collection = client.collections(collectionName);
	if (await collection.exists()) {
		await collection.delete();
	}

	await client.collections().create({
		name: collectionName,
		fields: [
			{ name: 'id', type: 'string' },
			{ name: 'url', type: 'string' },
			{ name: 'title', type: 'string' },
			{ name: 'description', type: 'string', optional: true },
			{ name: 'content', type: 'string' }
		]
	});

	const results = await client
		.collections(collectionName)
		.documents()
		.import(
			docs.map((doc) => ({
				id: doc.id,
				url: doc.url,
				title: doc.title,
				description: doc.description ?? '',
				content: doc.content
			})),
			{ action: 'upsert' }
		);

	const failures = results.filter((result) => !result.success);
	if (failures.length > 0) {
		console.error(failures);
		throw new Error(`${failures.length}/${docs.length} documents failed to import.`);
	}

	console.log(`Synced ${docs.length} documents to Typesense collection "${collectionName}".`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
