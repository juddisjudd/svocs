import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
	fetchLatestPackage,
	findLegacyLibImports,
	hashFile,
	isNewerVersion,
	kitMajor,
	MANIFEST_FILE,
	readManifest
} from './shared.mjs';

function sortObjectKeys(obj) {
	return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

export async function runUpdate(args) {
	const dir = resolve(args.find((arg) => !arg.startsWith('-')) ?? '.');
	const dryRun = args.includes('--dry-run');
	const yes = args.includes('--yes');
	const force = args.includes('--force');
	const fromDir = args.find((arg) => arg.startsWith('--from='))?.slice('--from='.length);

	p.intro(pc.bold('svocs update'));

	const manifest = readManifest(dir);
	if (!manifest) {
		p.log.error(
			`No ${MANIFEST_FILE} in ${dir}. Updates need the scaffold manifest that create-svocs-docs >= 0.17 writes; older scaffolds have to apply template changes by hand.`
		);
		p.outro('Nothing updated.');
		return 1;
	}

	const tmpRoot = mkdtempSync(join(tmpdir(), 'svocs-update-'));
	try {
		let packageDir;
		let version;
		if (fromDir) {
			packageDir = resolve(fromDir);
			version = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')).version;
			p.log.info(`Using local package at ${packageDir} (${version}).`);
		} else {
			const s = p.spinner();
			s.start('Fetching the latest create-svocs-docs from npm');
			({ dir: packageDir, version } = await fetchLatestPackage(tmpRoot));
			s.stop(`Fetched create-svocs-docs ${version}`);
		}

		if (!force && !isNewerVersion(version, manifest.templateVersion)) {
			const detail =
				version === manifest.templateVersion
					? ''
					: ` (this site is on ${manifest.templateVersion})`;
			p.outro(pc.green(`Already up to date: template ${version}${detail}.`));
			return 0;
		}

		const scaffoldModule = join(packageDir, 'lib', 'scaffold.mjs');
		if (!existsSync(scaffoldModule)) {
			p.log.error(`create-svocs-docs ${version} can't drive updates (no lib/scaffold.mjs).`);
			p.outro('Nothing updated.');
			return 1;
		}
		const { scaffold, hashScaffold } = await import(pathToFileURL(scaffoldModule));

		// Rebuild what an untouched scaffold of the new template looks like,
		// using the options recorded at scaffold time.
		const expectedDir = join(tmpRoot, 'expected');
		scaffold(expectedDir, manifest.options, {
			templateDir: join(packageDir, 'template'),
			recipesDir: join(packageDir, 'recipes', 'search')
		});
		const expectedHashes = hashScaffold(expectedDir);

		const plan = { add: [], update: [], skip: [], unchanged: [], deleted: [] };
		for (const [rel, expectedHash] of Object.entries(expectedHashes)) {
			// Migrated and repo-analysis sites replaced the starter content; the whole
			// content/ tree is user-owned there, including template additions.
			if ((manifest.migrated || manifest.ownsContent) && rel.startsWith('content/')) {
				continue;
			}
			const localPath = join(dir, rel);
			if (!existsSync(localPath)) {
				// Scaffolded, then removed: the user deleted it on purpose (a site
				// embedding svocs in an existing app drops the landing page, for
				// one). Only files new to the template get added.
				if (manifest.files?.[rel]) {
					plan.deleted.push(rel);
				} else {
					plan.add.push(rel);
				}
			} else {
				const localHash = hashFile(localPath);
				if (localHash === expectedHash) {
					plan.unchanged.push(rel);
				} else if (localHash === manifest.files?.[rel]) {
					plan.update.push(rel);
				} else {
					plan.skip.push(rel);
				}
			}
		}
		// Files the old template owned that the new one dropped: report only,
		// never delete — they may still be imported by user code.
		const orphans = Object.keys(manifest.files ?? {}).filter(
			(rel) => !(rel in expectedHashes) && existsSync(join(dir, rel))
		);

		if (plan.deleted.length > 0) {
			const listed = plan.deleted.slice(0, 5).join(', ');
			const more = plan.deleted.length > 5 ? ` and ${plan.deleted.length - 5} more` : '';
			p.log.info(
				`${pc.dim('leaving out')} ${plan.deleted.length} file(s) you deleted: ${listed}${more}. Remove an entry from ${MANIFEST_FILE} to get that file back.`
			);
		}

		if (plan.add.length + plan.update.length === 0) {
			for (const rel of plan.skip) {
				p.log.warn(`modified, review manually: ${rel}`);
			}
			p.outro(pc.green(`Template ${version}: nothing to apply.`));
			if (!dryRun) {
				writeUpdatedManifest(dir, manifest, version, expectedHashes, plan);
			}
			return 0;
		}

		for (const rel of plan.add) p.log.info(`${pc.green('add')}     ${rel}`);
		for (const rel of plan.update) p.log.info(`${pc.cyan('update')}  ${rel}`);
		for (const rel of plan.skip) p.log.warn(`${pc.yellow('skip')}    ${rel} (you modified it)`);
		for (const rel of orphans)
			p.log.warn(`${pc.yellow('orphan')}  ${rel} (no longer in the template; left in place)`);

		const toKit3 = kitMajor(expectedDir) >= 3 && kitMajor(dir) < 3;
		if (toKit3) {
			p.log.info('This update moves the site from SvelteKit 2 to SvelteKit 3.');
		}

		if (dryRun) {
			p.outro(
				`Dry run: ${plan.add.length} to add, ${plan.update.length} to update, ${plan.skip.length} skipped.`
			);
			return 0;
		}

		if (!yes) {
			if (!process.stdin.isTTY) {
				p.log.error('Not a TTY; pass --yes to apply (or --dry-run to preview).');
				p.outro('Nothing updated.');
				return 1;
			}
			const proceed = await p.confirm({
				message: `Apply ${plan.add.length + plan.update.length} file(s) from template ${version}?`,
				initialValue: true
			});
			if (p.isCancel(proceed) || !proceed) {
				p.outro('Nothing updated.');
				return 0;
			}
		}

		for (const rel of [...plan.add, ...plan.update]) {
			const target = join(dir, rel);
			mkdirSync(dirname(target), { recursive: true });
			copyFileSync(join(expectedDir, rel), target);
		}
		writeUpdatedManifest(dir, manifest, version, expectedHashes, plan);

		const parts = [
			plan.add.length && `${plan.add.length} added`,
			plan.update.length && `${plan.update.length} updated`,
			plan.skip.length && `${plan.skip.length} skipped (modified by you)`
		].filter(Boolean);
		p.outro(pc.green(`Template ${manifest.templateVersion} → ${version}: ${parts.join(', ')}.`));
		console.log('Updates apply to source files — rebuild (or restart dev) to see them.');
		if (plan.update.some((rel) => rel === 'package.json') || plan.add.length > 0) {
			console.log("Dependencies may have changed — rerun your package manager's install.");
		} else if (plan.skip.includes('package.json')) {
			console.log(
				'package.json was skipped (you modified it) — compare its dependencies against the new template if a build breaks.'
			);
		}
		if (toKit3 && kitMajor(dir) < 3) {
			console.log(
				'package.json still asks for SvelteKit 2. Copy the dependency versions and the "imports" field from the new template\'s package.json, then reinstall.'
			);
		}
		if (kitMajor(expectedDir) >= 3) {
			const legacy = findLegacyLibImports(dir);
			if (legacy.length > 0) {
				console.log(
					`SvelteKit 3 removed the $lib alias. Change $lib/ to #lib/ in:\n  ${legacy.join('\n  ')}`
				);
			}
		}
		return 0;
	} finally {
		rmSync(tmpRoot, { recursive: true, force: true });
	}
}

/**
 * Applied and untouched files advance to the new template hash; files the
 * user modified keep their old recorded hash, so the next update still
 * recognizes them as user-owned.
 */
function writeUpdatedManifest(dir, manifest, version, expectedHashes, plan) {
	const files = {};
	for (const rel of [...plan.add, ...plan.update, ...plan.unchanged]) {
		files[rel] = expectedHashes[rel];
	}
	// Modified and deleted files keep their recorded hash, so the next update
	// still treats them as the user's.
	for (const rel of [...plan.skip, ...plan.deleted]) {
		if (manifest.files?.[rel]) {
			files[rel] = manifest.files[rel];
		}
	}
	const next = { ...manifest, templateVersion: version, files: sortObjectKeys(files) };
	writeFileSync(join(dir, MANIFEST_FILE), `${JSON.stringify(next, null, '\t')}\n`);
}
