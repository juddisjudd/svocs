// Dispatches the post-`vite build` indexing step for the active search
// backend. Kept as a plain Node script (not vite-node) — everything it
// needs (a provider name, a shell command to run) is available without
// resolving $lib aliases or import.meta.glob, and the two sync scripts
// that DO need real content already read it from the prerendered
// build/search-index.json instead of re-parsing content/ themselves.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';

const provider = process.env.PUBLIC_SVOCS_SEARCH_PROVIDER || 'pagefind';

// shell:true lets Windows resolve locally-installed .cmd/.ps1 binary shims,
// but Node warns if you combine it with a separate args array (args aren't
// escaped, only concatenated) — every arg here is a hardcoded literal, never
// user input, so a single pre-joined command string sidesteps the warning
// without changing behavior.
function run(command, args) {
	const result = spawnSync([command, ...args].join(' '), { stdio: 'inherit', shell: true });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

// `vite preview` never looks at adapter-static's `build/` output — SvelteKit's
// preview server serves the pre-adapter `.svelte-kit/output/client` directory
// instead (see @sveltejs/kit's exports/vite/preview). Everything Vite itself
// writes there (prerendered routes, `static/`) shows up fine; Pagefind's index
// doesn't, because the CLI runs after `vite build` and writes straight into
// `build/`, a tree `vite preview` never reads from. Mirroring the index into
// `output/client` too is what makes `bun run preview` actually work for it.
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
		// Indexed as a prerendered static route during `vite build` itself —
		// nothing left to do here.
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
