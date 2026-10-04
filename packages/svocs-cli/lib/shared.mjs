import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export const MANIFEST_FILE = '.svocs.json';
export const CREATE_PACKAGE = 'create-svocs-docs';
const REGISTRY = 'https://registry.npmjs.org';

export function readManifest(dir) {
	const path = join(dir, MANIFEST_FILE);
	if (!existsSync(path)) {
		return null;
	}
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return null;
	}
}

export function hashFile(path) {
	return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function isNewerVersion(candidate, current) {
	const a = candidate.split('.').map(Number);
	const b = current.split('.').map(Number);
	for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
		const diff = (a[i] ?? 0) - (b[i] ?? 0);
		if (diff !== 0) return diff > 0;
	}
	return false;
}

/** Major version of @sveltejs/kit a site's package.json asks for, or 0. */
export function kitMajor(dir) {
	try {
		const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
		const range = pkg.devDependencies?.['@sveltejs/kit'] ?? pkg.dependencies?.['@sveltejs/kit'];
		return Number(range?.match(/\d+/)?.[0] ?? 0);
	} catch {
		return 0;
	}
}

/** Files under src/ and content/ that still import through `$lib`, which SvelteKit 3 removed. */
export function findLegacyLibImports(dir) {
	const hits = [];
	const walk = (rel) => {
		const full = join(dir, rel);
		if (!existsSync(full)) return;
		for (const entry of readdirSync(full, { withFileTypes: true })) {
			const childRel = `${rel}/${entry.name}`;
			if (entry.isDirectory()) {
				walk(childRel);
			} else if (
				/\.(svelte|svx|md|ts|js)$/.test(entry.name) &&
				/['"]\$lib[/'"]/.test(readFileSync(join(dir, childRel), 'utf8'))
			) {
				hits.push(childRel);
			}
		}
	};
	walk('src');
	walk('content');
	return hits;
}

/** True when the directory looks like a scaffolded SVOCS site at all. */
export function looksLikeSvocsSite(dir) {
	return existsSync(join(dir, 'src/lib/site.ts')) && existsSync(join(dir, 'content'));
}

export async function fetchLatestVersion(timeoutMs = 4000) {
	const response = await fetch(`${REGISTRY}/${CREATE_PACKAGE}/latest`, {
		headers: { accept: 'application/json' },
		signal: AbortSignal.timeout(timeoutMs)
	});
	if (!response.ok) {
		throw new Error(`npm registry responded ${response.status}`);
	}
	return response.json();
}

/**
 * Download the latest create-svocs-docs tarball and extract it, returning
 * the extracted package directory. Uses the system `tar`, which ships with
 * Windows 10+, macOS, and every mainstream Linux.
 */
export async function fetchLatestPackage(tmpRoot) {
	const { version, dist } = await fetchLatestVersion();
	const tarballResponse = await fetch(dist.tarball, { signal: AbortSignal.timeout(60_000) });
	if (!tarballResponse.ok) {
		throw new Error(`tarball download failed (${tarballResponse.status})`);
	}
	writeFileSync(
		join(tmpRoot, 'create-svocs-docs.tgz'),
		Buffer.from(await tarballResponse.arrayBuffer())
	);

	mkdirSync(join(tmpRoot, 'pkg'), { recursive: true });
	// Relative paths from tmpRoot: GNU tar (Git Bash on Windows) reads an
	// absolute `C:\…` archive path as `host:path` and tries to reach host "C".
	const result = spawnSync('tar', ['-xzf', 'create-svocs-docs.tgz', '-C', 'pkg'], {
		cwd: tmpRoot,
		stdio: ['ignore', 'ignore', 'pipe'],
		encoding: 'utf8',
		timeout: 60_000
	});
	if (result.error || result.status !== 0) {
		const detail = result.stderr?.trim() || result.error?.message;
		throw new Error(
			`Extracting the tarball failed${detail ? `: ${detail}` : ' — is `tar` on your PATH?'}`
		);
	}
	return { dir: join(tmpRoot, 'pkg', 'package'), version };
}
