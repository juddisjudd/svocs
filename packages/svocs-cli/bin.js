#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDoctor } from './lib/doctor.mjs';
import { runMigrate } from './lib/migrate.mjs';
import { runUpdate } from './lib/update.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')).version;

const HELP = `svocs ${VERSION} — companion CLI for SVOCS docs sites

Usage:
  svocs doctor [dir]           Check a site's configuration for common problems
  svocs update [dir]           Apply template updates to files you haven't modified
    --dry-run                  Show what would change without writing anything
    --yes                      Apply without asking for confirmation
    --force                    Re-sync even when the template version matches
    --from=<dir>               Use a local create-svocs-docs package instead of npm
  svocs migrate <src> <dest>   Convert an existing docs site into a new svocs site
                               (Fumadocs, Nextra, Docusaurus, Starlight, MkDocs, mdBook)
    --source=<framework>       Force the source framework instead of auto-detecting
    --site-name=<name>         Site name (default: derived from the source config)
    --site-url=<origin>        Production URL for the new site
    --repo-url=<url>           Repository link for the new site's header and "Edit on GitHub"
    --repo-branch=<name>       Branch "Edit on GitHub" links point at (default: main)
    --accent=<hex>             Accent color
    --search=<backend>         Search backend (default: pagefind)
    --from=<dir>               Use a local create-svocs-docs package instead of npm

Sites scaffolded with create-svocs-docs >= 0.17 record a .svocs.json manifest;
\`update\` needs it to tell your edits apart from template files.`;

async function main() {
	const args = process.argv.slice(2);
	const command = args.find((arg) => !arg.startsWith('-'));
	const rest = args.filter((arg) => arg !== command);

	switch (command) {
		case 'doctor':
			process.exitCode = await runDoctor(rest);
			return;
		case 'update':
			process.exitCode = await runUpdate(rest);
			return;
		case 'migrate':
			process.exitCode = await runMigrate(args.filter((arg) => arg !== command));
			return;
		default:
			if (args.includes('--version') || args.includes('-v')) {
				console.log(VERSION);
				return;
			}
			console.log(HELP);
			if (command) {
				console.error(`\nUnknown command: "${command}"`);
				process.exitCode = 1;
			}
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
