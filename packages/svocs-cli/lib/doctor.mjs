import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { fetchLatestVersion, isNewerVersion, looksLikeSvocsSite, readManifest } from './shared.mjs';

function readFileOr(path, fallback = '') {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return fallback;
	}
}

/** Parse just enough of a .env file to know which keys are set. */
function envKeys(dir) {
	const keys = new Set(Object.keys(process.env));
	for (const file of ['.env', '.env.local']) {
		for (const line of readFileOr(join(dir, file)).split('\n')) {
			const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*\S/);
			if (match) {
				keys.add(match[1]);
			}
		}
	}
	return keys;
}

const SEARCH_ENV_VARS = {
	typesense: [
		'PUBLIC_TYPESENSE_HOST',
		'PUBLIC_TYPESENSE_COLLECTION_NAME',
		'PUBLIC_TYPESENSE_SEARCH_API_KEY'
	],
	chroma: ['PUBLIC_CHROMA_HOST', 'PUBLIC_CHROMA_COLLECTION_NAME', 'PUBLIC_CHROMA_TOKEN']
};

export async function runDoctor(args) {
	const dir = resolve(args.find((arg) => !arg.startsWith('-')) ?? '.');
	p.intro(pc.bold('svocs doctor'));

	if (!looksLikeSvocsSite(dir)) {
		p.log.error(`${dir} doesn't look like a SVOCS site (no src/lib/site.ts + content/).`);
		p.outro('Run this from a scaffolded docs site.');
		return 1;
	}

	let errors = 0;
	let warnings = 0;
	const ok = (message) => p.log.success(message);
	const warn = (message) => {
		warnings += 1;
		p.log.warn(message);
	};
	const fail = (message) => {
		errors += 1;
		p.log.error(message);
	};

	// Manifest / template version
	const manifest = readManifest(dir);
	if (manifest) {
		ok(`Scaffolded from create-svocs-docs ${manifest.templateVersion} (.svocs.json present).`);
	} else {
		warn(
			'No .svocs.json manifest — scaffolded with create-svocs-docs < 0.17, so `svocs update` is unavailable.'
		);
	}

	// SITE_URL and its dependents
	const siteSource = readFileOr(join(dir, 'src/lib/site.ts'));
	const siteUrl = siteSource.match(/SITE_URL\s*=\s*'([^']*)'/)?.[1] ?? '';
	if (siteUrl) {
		ok(`SITE_URL is set (${siteUrl}).`);
		const robots = readFileOr(join(dir, 'static/robots.txt'));
		if (robots && !/^Sitemap:/m.test(robots)) {
			warn(`static/robots.txt has no Sitemap line — add: Sitemap: ${siteUrl}/sitemap.xml`);
		}
	} else {
		warn(
			'SITE_URL is empty in src/lib/site.ts — social-card tags are off, sitemap.xml is empty, and llms.txt links stay relative.'
		);
	}

	// Fonts the OG generator needs
	const missingFonts = ['satoshi-500.woff2', 'satoshi-900.woff2'].filter(
		(font) => !existsSync(join(dir, 'static/fonts', font))
	);
	if (missingFonts.length > 0) {
		fail(`Missing static/fonts/${missingFonts.join(', ')} — OG card generation will fail.`);
	} else {
		ok('OG card fonts present.');
	}

	// Server-backed search backends need env vars at build time
	const viteConfig = readFileOr(join(dir, 'vite.config.ts'));
	const backend = viteConfig.match(/PUBLIC_SVOCS_SEARCH_PROVIDER \?\?= '(\w+)'/)?.[1] ?? 'pagefind';
	const requiredVars = SEARCH_ENV_VARS[backend];
	if (requiredVars) {
		const available = envKeys(dir);
		const missing = requiredVars.filter((name) => !available.has(name));
		if (missing.length > 0) {
			warn(`Search backend "${backend}" needs env vars not set here: ${missing.join(', ')}.`);
		} else {
			ok(`Search backend "${backend}" env vars are set.`);
		}
	} else {
		ok(`Search backend "${backend}" needs no server config.`);
	}

	if (!existsSync(join(dir, 'node_modules'))) {
		warn('No node_modules — run your package manager\'s install first.');
	}

	// Best-effort update check; network problems are not the user's problem.
	if (manifest) {
		try {
			const { version: latest } = await fetchLatestVersion();
			if (isNewerVersion(latest, manifest.templateVersion)) {
				p.log.info(
					`Template update available: ${manifest.templateVersion} → ${latest}. Run ${pc.cyan('svocs update')}.`
				);
			} else {
				ok('Template is up to date.');
			}
		} catch {
			// offline or registry hiccup — skip silently
		}
	}

	const summary =
		errors > 0
			? pc.red(`${errors} error(s), ${warnings} warning(s).`)
			: warnings > 0
				? pc.yellow(`${warnings} warning(s).`)
				: pc.green('All checks passed.');
	p.outro(summary);
	return errors > 0 ? 1 : 0;
}
