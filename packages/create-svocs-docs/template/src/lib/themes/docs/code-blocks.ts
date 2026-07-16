const SVG_NS = 'http://www.w3.org/2000/svg';

function createSvg(paths: Array<Record<string, string>>): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 16 16');
	svg.setAttribute('aria-hidden', 'true');

	for (const attrs of paths) {
		const el = document.createElementNS(SVG_NS, attrs.tag);
		for (const [name, value] of Object.entries(attrs)) {
			if (name !== 'tag') {
				el.setAttribute(name, value);
			}
		}
		svg.appendChild(el);
	}

	return svg;
}

function copyIcon(): SVGSVGElement {
	return createSvg([
		{
			tag: 'rect',
			x: '5.5',
			y: '5.5',
			width: '8',
			height: '8',
			rx: '1.5',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '1.4'
		},
		{
			tag: 'path',
			d: 'M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '1.4'
		}
	]);
}

function checkIcon(): SVGSVGElement {
	return createSvg([
		{
			tag: 'path',
			d: 'M13.5 4.5 6.75 11.25 3 7.5',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '1.8',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round'
		}
	]);
}

/**
 * Progressively enhances the prerendered code frames inside `container` with
 * a copy button. The .code-frame / .code-frame-header / .code-frame-body
 * wrapper (and the filename header) is emitted at build time by
 * src/lib/build/code-highlighter.ts — this only appends a button into the
 * existing .code-frame-body.
 *
 * Runs as plain DOM manipulation rather than a Svelte template because the
 * markup comes from mdsvex-compiled static HTML, not this component's own
 * template — there's nothing for Svelte to bind to declaratively.
 *
 * IMPORTANT: never move or replace the `<pre>` (or any other node) here.
 * These nodes belong to the mdsvex-compiled Svelte component's fragment, and
 * re-parenting a fragment-boundary node (a doc ending in a code fence)
 * corrupts Svelte's teardown on navigation — every doc page after that
 * renders with an empty body until a full reload. Appending new children
 * into an existing element is safe; re-parenting existing ones is not.
 */
export function enhanceCodeBlocks(container: HTMLElement | null): void {
	if (!container) {
		return;
	}

	const blocks = container.querySelectorAll<HTMLPreElement>(
		'.code-frame-body > pre:not([data-enhanced])'
	);

	for (const pre of blocks) {
		pre.dataset.enhanced = 'true';

		const body = pre.parentElement as HTMLElement;
		const code = pre.querySelector('code');

		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'code-copy';
		button.setAttribute('aria-label', 'Copy code');
		button.appendChild(copyIcon());

		let resetHandle: ReturnType<typeof setTimeout> | undefined;
		button.addEventListener('click', () => {
			const text = code?.textContent ?? '';
			navigator.clipboard.writeText(text).then(() => {
				button.classList.add('copied');
				button.replaceChildren(checkIcon());
				button.setAttribute('aria-label', 'Copied');
				clearTimeout(resetHandle);
				resetHandle = setTimeout(() => {
					button.classList.remove('copied');
					button.replaceChildren(copyIcon());
					button.setAttribute('aria-label', 'Copy code');
				}, 1600);
			});
		});

		body.appendChild(button);
	}
}
