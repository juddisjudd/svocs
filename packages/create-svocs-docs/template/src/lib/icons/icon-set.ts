// Curated page/section icon set. Every icon is built from plain SVG
// primitives (path/circle/rect) on a 16x16 grid at stroke-width 1.3, the
// same hand-drawn convention as Callout and the sidebar chrome — no icon
// library dependency. Add an icon by adding a name here; `icon: <name>` in
// frontmatter or `_meta.json` then resolves to it (see PageIcon.svelte).
export type IconShape =
	| { type: 'path'; d: string; fill?: 'currentColor' | 'none'; stroke?: 'currentColor' | 'none' }
	| { type: 'circle'; cx: number; cy: number; r: number; fill?: 'currentColor' | 'none' }
	| { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number };

export const ICONS: Record<string, IconShape[]> = {
	rocket: [
		{ type: 'path', d: 'M8 2 L10.2 6.5 L5.8 6.5 Z', fill: 'currentColor', stroke: 'none' },
		{ type: 'rect', x: 5.8, y: 6.5, width: 4.4, height: 4.5, rx: 1.4 },
		{
			type: 'path',
			d: 'M5.8 9.5 L3.5 12 L5.8 11.3 Z M10.2 9.5 L12.5 12 L10.2 11.3 Z',
			fill: 'currentColor',
			stroke: 'none'
		},
		{ type: 'circle', cx: 8, cy: 8.6, r: 0.85 }
	],
	book: [
		{ type: 'rect', x: 2.5, y: 3, width: 11, height: 10, rx: 1 },
		{ type: 'path', d: 'M8 3 V13' }
	],
	gear: [
		{ type: 'circle', cx: 8, cy: 8, r: 2.6 },
		{ type: 'circle', cx: 8, cy: 8, r: 1.1 },
		{
			type: 'path',
			d: 'M10.6 8 L11.6 8 M9.3 10.25 L9.8 11.12 M6.7 10.25 L6.2 11.12 M5.4 8 L4.4 8 M6.7 5.75 L6.2 4.88 M9.3 5.75 L9.8 4.88'
		}
	],
	terminal: [
		{ type: 'rect', x: 2, y: 3, width: 12, height: 10, rx: 1 },
		{ type: 'path', d: 'M4.5 6.5 L7 8 L4.5 9.5' },
		{ type: 'path', d: 'M8.5 9.5 H11.5' }
	],
	code: [
		{ type: 'path', d: 'M6 5 L3 8 L6 11' },
		{ type: 'path', d: 'M10 5 L13 8 L10 11' }
	],
	folder: [{ type: 'path', d: 'M2.5 4.5 H6.5 L7.5 6 H13.5 V12.5 H2.5 Z' }],
	file: [
		{ type: 'path', d: 'M4 2.5 H9.5 L12 5 V13.5 H4 Z' },
		{ type: 'path', d: 'M9.5 2.5 V5 H12' }
	],
	package: [
		{ type: 'path', d: 'M8 2 L14 5 V11 L8 14 L2 11 V5 Z' },
		{ type: 'path', d: 'M2 5 L8 8 L14 5 M8 8 V14' }
	],
	zap: [
		{
			type: 'path',
			d: 'M9 2 L4.5 9 H7.5 L6.5 14 L12 6.5 H8.5 Z',
			fill: 'currentColor',
			stroke: 'none'
		}
	],
	shield: [{ type: 'path', d: 'M8 2 L13 4 V8.5 L8 14 L3 8.5 V4 Z' }],
	layers: [
		{ type: 'path', d: 'M8 3 L14 6.5 L8 10 L2 6.5 Z' },
		{ type: 'path', d: 'M2 9.5 L8 13 L14 9.5' }
	],
	star: [
		{
			type: 'path',
			d: 'M8 2.5 L9.29 6.22 L13.23 6.3 L10.09 8.68 L11.23 12.45 L8 10.2 L4.77 12.45 L5.91 8.68 L2.77 6.3 L6.71 6.22 Z',
			fill: 'currentColor',
			stroke: 'none'
		}
	],
	flag: [
		{ type: 'path', d: 'M4 2 V14' },
		{ type: 'path', d: 'M4 2.5 H11 L9 5.5 L11 8.5 H4' }
	],
	key: [
		{ type: 'circle', cx: 5, cy: 8, r: 2.5 },
		{ type: 'path', d: 'M7.5 8 H13.5 M11 8 V10 M13 8 V9.7' }
	],
	lock: [
		{ type: 'rect', x: 4, y: 7.5, width: 8, height: 6, rx: 1 },
		{ type: 'path', d: 'M5.5 7.5 V5.5 A2.5 2.5 0 0 1 10.5 5.5 V7.5' }
	],
	lightbulb: [
		{ type: 'circle', cx: 8, cy: 6.5, r: 3.3 },
		{ type: 'rect', x: 6.3, y: 9.6, width: 3.4, height: 1.8, rx: 0.4 },
		{ type: 'path', d: 'M6.8 11.8 H9.2' }
	],
	globe: [
		{ type: 'circle', cx: 8, cy: 8, r: 5.5 },
		{ type: 'path', d: 'M2.5 8 H13.5' },
		{ type: 'path', d: 'M8 2.5 A2.2 5.5 0 0 0 8 13.5' },
		{ type: 'path', d: 'M8 2.5 A2.2 5.5 0 0 1 8 13.5' }
	],
	target: [
		{ type: 'circle', cx: 8, cy: 8, r: 5 },
		{ type: 'circle', cx: 8, cy: 8, r: 3 },
		{ type: 'circle', cx: 8, cy: 8, r: 1, fill: 'currentColor' }
	]
};

export type IconName = keyof typeof ICONS;
