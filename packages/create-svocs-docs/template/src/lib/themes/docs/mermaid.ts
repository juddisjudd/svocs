/**
 * Lazily renders `<pre class="mermaid">` blocks (emitted by the build-time
 * code highlighter, src/lib/build/code-highlighter.ts) into inline SVG in
 * the reader's browser. The mermaid bundle is large, so it's a dynamic
 * import that only ever loads on pages actually containing a diagram —
 * every other page ships none of it, and builds need no browser at all.
 *
 * mermaid.run() renders into the <pre> in place (and stamps it with
 * data-processed) — it never moves or replaces the element itself, which
 * matters: these nodes belong to a Svelte-compiled fragment, and
 * re-parenting them corrupts teardown on client-side navigation.
 */
let mermaidImport: Promise<typeof import('mermaid')> | undefined;

export function renderMermaidBlocks(root: HTMLElement | null): void {
	const nodes = root
		? Array.from(root.querySelectorAll<HTMLElement>('pre.mermaid:not([data-processed])'))
		: [];
	if (nodes.length === 0) {
		return;
	}

	mermaidImport ??= import('mermaid');
	void mermaidImport.then(async ({ default: mermaid }) => {
		mermaid.initialize({
			startOnLoad: false,
			// The SVG bakes its colors in at render time, so a diagram keeps the
			// theme that was active when it rendered; it picks up the other mode
			// on the next navigation, not live on toggle.
			theme: document.documentElement.dataset.theme === 'light' ? 'neutral' : 'dark'
		});
		try {
			await mermaid.run({ nodes });
		} catch (error) {
			// A syntax error in one fence shouldn't take down navigation —
			// mermaid leaves its message in the block itself.
			console.error('[svocs] mermaid render failed:', error);
		}
	});
}
