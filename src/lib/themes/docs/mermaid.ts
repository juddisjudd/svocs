/**
 * Renders `<pre class="mermaid">` blocks into inline SVG in the browser.
 * Mermaid is a large bundle, so it's dynamically imported only on pages
 * containing a diagram. mermaid.run() renders in place — never re-parent
 * these Svelte-fragment nodes; that corrupts teardown on navigation.
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
			// Colors bake in at render time; a theme toggle applies on the next
			// navigation, not live.
			theme: document.documentElement.dataset.theme === 'light' ? 'neutral' : 'dark'
		});
		try {
			await mermaid.run({ nodes });
		} catch (error) {
			// Mermaid leaves its error message in the block itself.
			console.error('[svocs] mermaid render failed:', error);
		}
	});
}
