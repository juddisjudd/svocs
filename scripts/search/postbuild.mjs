// Dispatches the post-`vite build` indexing step for the active search backend.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';

const provider = process.env.PUBLIC_SVOCS_SEARCH_PROVIDER || 'pagefind';

// shell:true resolves Windows .cmd shims; args are hardcoded literals, so
// pre-joining the command string is safe and avoids Node's escaping warning.
function run(command, args) {
	const result = spawnSync([command, ...args].join(' '), { stdio: 'inherit', shell: true });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

// `vite preview` serves .svelte-kit/output/client, not build/, so the
// pagefind index has to be mirrored there for previews to find it.
function mirrorIntoPreviewOutput() {
	const previewClientDir = '.svelte-kit/output/client';
	if (!existsSync(previewClientDir)) {
		return;
	}
	cpSync('build/pagefind', `${previewClientDir}/pagefind`, { recursive: true });
}

switch (provider) {
	case 'pagefind':
		run('pagefind', ['--site', 'build']);
		mirrorIntoPreviewOutput();
		break;
	case 'orama':
	case 'flexsearch':
		console.log(`${provider}: index already built into build/ during vite build.`);
		break;
	case 'typesense':
		run('bun', ['run', 'scripts/search/sync-typesense.ts']);
		break;
	case 'chroma':
		run('bun', ['run', 'scripts/search/sync-chroma.ts']);
		break;
	default:
		throw new Error(
			`Unknown PUBLIC_SVOCS_SEARCH_PROVIDER: "${provider}". Expected one of: pagefind, orama, flexsearch, typesense, chroma.`
		);
}
