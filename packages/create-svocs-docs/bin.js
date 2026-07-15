#!/usr/bin/env node
import { existsSync, readdirSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, 'template');

const RENAMES = {
	_gitignore: '.gitignore',
	_npmrc: '.npmrc',
	_nojekyll: '.nojekyll'
};

// Files that get __SITE_NAME__ / __PACKAGE_NAME__ substitution — every text
// file we ship, matched by extension rather than a hardcoded path list so
// future template additions don't need this list updated too.
const TEXT_EXTENSIONS = new Set([
	'.md',
	'.svx',
	'.json',
	'.js',
	'.ts',
	'.svelte',
	'.html',
	'.txt',
	''
]);

function detectPackageManager() {
	if (typeof globalThis.Deno !== 'undefined') return 'deno';
	const ua = process.env.npm_config_user_agent ?? '';
	if (ua.startsWith('bun')) return 'bun';
	if (ua.startsWith('pnpm')) return 'pnpm';
	if (ua.startsWith('yarn')) return 'yarn';
	return 'npm';
}

function toPackageName(name) {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-~]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'svocs-docs';
}

function toSiteName(dirName) {
	return dirName
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function isDirEmpty(dir) {
	return !existsSync(dir) || readdirSync(dir).length === 0;
}

function copyTemplate(srcDir, destDir) {
	mkdirSync(destDir, { recursive: true });
	for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
		const srcPath = join(srcDir, entry.name);
		const destName = RENAMES[entry.name] ?? entry.name;
		const destPath = join(destDir, destName);

		if (entry.isDirectory()) {
			copyTemplate(srcPath, destPath);
			continue;
		}

		const contents = readFileSync(srcPath);
		writeFileSync(destPath, contents);
	}
}

function applySubstitutions(dir, siteName, packageName) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const entryPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			applySubstitutions(entryPath, siteName, packageName);
			continue;
		}

		const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : '';
		if (!TEXT_EXTENSIONS.has(ext)) {
			continue;
		}

		const original = readFileSync(entryPath, 'utf8');
		const replaced = original
			.replaceAll('__SITE_NAME__', siteName)
			.replaceAll('__PACKAGE_NAME__', packageName);

		if (replaced !== original) {
			writeFileSync(entryPath, replaced);
		}
	}
}

async function main() {
	const args = process.argv.slice(2);
	const targetArg = args.find((arg) => !arg.startsWith('-'));

	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const isInteractive = process.stdin.isTTY;

	async function ask(question, fallback) {
		if (!isInteractive) return fallback;
		const answer = (await rl.question(question)).trim();
		return answer || fallback;
	}

	async function confirm(question, fallback) {
		if (!isInteractive) return fallback;
		const answer = (await rl.question(`${question} (${fallback ? 'Y/n' : 'y/N'}) `))
			.trim()
			.toLowerCase();
		if (!answer) return fallback;
		return answer === 'y' || answer === 'yes';
	}

	const targetDir = resolve(targetArg ?? (await ask('Project directory: (my-docs) ', 'my-docs')));
	const dirName = basename(targetDir);

	if (existsSync(targetDir) && !isDirEmpty(targetDir)) {
		const proceed = await confirm(
			`"${dirName}" already exists and isn't empty. Continue anyway?`,
			false
		);
		if (!proceed) {
			console.log('Aborted.');
			rl.close();
			process.exitCode = 1;
			return;
		}
	}

	const siteName = await ask(`Site name: (${toSiteName(dirName)}) `, toSiteName(dirName));
	const packageName = toPackageName(dirName);
	const shouldInitGit = await confirm('Initialize a git repository?', true);

	rl.close();

	console.log(`\nScaffolding "${siteName}" in ${targetDir} ...`);
	copyTemplate(TEMPLATE_DIR, targetDir);
	applySubstitutions(targetDir, siteName, packageName);

	if (shouldInitGit) {
		const gitDir = join(targetDir, '.git');
		if (!existsSync(gitDir)) {
			const result = spawnSync('git', ['init'], { cwd: targetDir, stdio: 'ignore' });
			if (result.error || result.status !== 0) {
				console.log('(skipped git init — git not available)');
			}
		}
	}

	const pm = detectPackageManager();
	const relativeDir = targetDir === process.cwd() ? '.' : dirName;

	const installCmd = {
		bun: 'bun install',
		pnpm: 'pnpm install',
		yarn: 'yarn',
		npm: 'npm install',
		deno: null
	}[pm];
	const devCmd = {
		bun: 'bun run dev',
		pnpm: 'pnpm dev',
		yarn: 'yarn dev',
		npm: 'npm run dev',
		deno: 'deno task dev'
	}[pm];

	console.log('\nDone. Next steps:\n');
	if (relativeDir !== '.') {
		console.log(`  cd ${relativeDir}`);
	}
	if (installCmd) {
		console.log(`  ${installCmd}`);
	}
	console.log(`  ${devCmd}`);
	console.log('');
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
