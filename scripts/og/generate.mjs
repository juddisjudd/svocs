// Renders a 1200x630 Open Graph card per prerendered page into build/og/,
// after `vite build`. satori + resvg, not a headless-browser screenshot, so
// builds never need Chromium. Titles/descriptions come from the built HTML's
// own meta tags. Set SVOCS_OG=0 to skip.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import wawoff2 from 'wawoff2';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const BUILD_DIR = 'build';
const OUT_DIR = join(BUILD_DIR, 'og');

if (process.env.SVOCS_OG === '0') {
	console.log('og: skipped (SVOCS_OG=0).');
	process.exit(0);
}

if (!existsSync(BUILD_DIR)) {
	console.error(`og: no ${BUILD_DIR}/ directory — run vite build first.`);
	process.exit(1);
}

// ---- theme + site facts, read from source so custom scaffolds stay in sync

function readFileOr(path, fallback) {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return fallback;
	}
}

const layoutSource = readFileOr('src/routes/+layout.svelte', '');
const siteSource = readFileOr('src/lib/site.ts', '');

const accent = layoutSource.match(/--accent:\s*(#[0-9a-fA-F]{3,8})/)?.[1] ?? '#ff3c00';
const siteName = siteSource.match(/SITE_NAME\s*=\s*'([^']*)'/)?.[1] || 'Docs';
const siteUrl = siteSource.match(/SITE_URL\s*=\s*'([^']*)'/)?.[1] || '';
const siteHost = siteUrl.replace(/^https?:\/\//, '');

// satori has no color-mix(), so the accent ramp is mixed here instead.
function hexChannels(hex) {
	const value = hex.replace('#', '');
	const size = value.length < 6 ? 1 : 2;
	return [0, 1, 2].map((i) =>
		parseInt(value.slice(i * size, i * size + size).padEnd(2, value[i * size]), 16)
	);
}

function mixWithWhite(hex, keep) {
	const [r, g, b] = hexChannels(hex).map((c) => Math.round(c * keep + 255 * (1 - keep)));
	return `rgb(${r}, ${g}, ${b})`;
}

function withAlpha(hex, alpha) {
	const [r, g, b] = hexChannels(hex);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---- collect prerendered pages

function collectHtmlFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (full === OUT_DIR || entry.name === 'pagefind') {
				continue;
			}
			out.push(...collectHtmlFiles(full));
		} else if (entry.name.endsWith('.html')) {
			out.push(full);
		}
	}
	return out;
}

function unescapeHtml(value) {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

function truncate(value, max) {
	return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function extractMeta(html) {
	const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1];
	const docTitle = html.match(/<title>([^<]*)<\/title>/)?.[1];
	const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
	return {
		// Strip the "| Site" suffix pages append to <title> when og:title is absent.
		title: unescapeHtml(ogTitle ?? docTitle?.split('|')[0].trim() ?? siteName),
		description: description ? unescapeHtml(description) : ''
	};
}

// ---- the card itself; edit this tree to restyle your social cards.
// satori element helper: every container must declare display: flex.

const h = (type, style, ...children) => ({
	type,
	props: { style, children: children.length <= 1 ? children[0] : children }
});

// The last crumb uses the page's real title so acronyms survive.
function crumbsFor(routePath, title) {
	if (routePath === '/') {
		return '';
	}
	const parents = routePath
		.split('/')
		.filter(Boolean)
		.slice(0, -1)
		.map((part) => part.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()));
	return [...parents, truncate(title, 40)].join(' / ');
}

function card({ title, description, routePath }) {
	return h(
		'div',
		{
			display: 'flex',
			flexDirection: 'column',
			width: '1200px',
			height: '630px',
			padding: '64px 72px 56px',
			backgroundColor: '#070304',
			color: '#f5f1ef',
			fontFamily: 'Satoshi',
			position: 'relative'
		},
		h('div', {
			position: 'absolute',
			top: '-340px',
			right: '-240px',
			width: '900px',
			height: '900px',
			backgroundImage: `radial-gradient(circle at center, ${withAlpha(accent, 0.22)} 0%, rgba(7, 3, 4, 0) 62%)`
		}),
		h(
			'div',
			{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '36px', fontWeight: 900 },
			h('div', {
				width: '16px',
				height: '38px',
				borderRadius: '5px',
				backgroundColor: accent
			}),
			siteName
		),
		h(
			'div',
			{
				display: 'flex',
				flexDirection: 'column',
				marginTop: 'auto',
				marginBottom: 'auto',
				paddingRight: '120px'
			},
			h(
				'div',
				{
					display: 'block',
					lineClamp: 3,
					fontSize: '72px',
					fontWeight: 900,
					lineHeight: 1.08,
					letterSpacing: '-1.5px'
				},
				truncate(title, 90)
			),
			description
				? h(
						'div',
						{
							display: 'block',
							lineClamp: 2,
							marginTop: '26px',
							fontSize: '30px',
							fontWeight: 500,
							lineHeight: 1.45,
							color: '#a09189'
						},
						truncate(description, 160)
					)
				: null
		),
		h(
			'div',
			{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'baseline',
				fontSize: '26px',
				fontWeight: 500,
				color: '#a09189'
			},
			h('div', { color: mixWithWhite(accent, 0.72) }, crumbsFor(routePath, title)),
			h('div', {}, siteHost)
		),
		h('div', {
			position: 'absolute',
			left: '0',
			right: '0',
			bottom: '0',
			height: '10px',
			backgroundImage: `linear-gradient(90deg, ${accent} 0%, ${withAlpha(accent, 0.25)} 100%)`
		})
	);
}

// ---- render

// Decompress one at a time — wawoff2's WASM corrupts output on overlapping
// calls — and .slice() the view, which aliases the WASM heap.
const fonts = [];
for (const { file, weight } of [
	{ file: 'static/fonts/satoshi-500.woff2', weight: 500 },
	{ file: 'static/fonts/satoshi-900.woff2', weight: 900 }
]) {
	fonts.push({
		name: 'Satoshi',
		weight,
		style: 'normal',
		data: (await wawoff2.decompress(readFileSync(file))).slice().buffer
	});
}

const files = collectHtmlFiles(BUILD_DIR);

for (const file of files) {
	// build/docs/theming.html -> /docs/theming -> build/og/docs/theming.png
	const rel = relative(BUILD_DIR, file)
		.replace(/\\/g, '/')
		.replace(/\.html$/, '');
	const routePath = rel === 'index' ? '/' : `/${rel.replace(/\/index$/, '')}`;
	const outFile = join(OUT_DIR, routePath === '/' ? 'index.png' : `${routePath.slice(1)}.png`);

	const { title, description } = extractMeta(readFileSync(file, 'utf8'));
	const svg = await satori(card({ title, description, routePath }), {
		width: 1200,
		height: 630,
		fonts
	});

	mkdirSync(dirname(outFile), { recursive: true });
	writeFileSync(outFile, new Resvg(svg).render().asPng());
}

console.log(`og: generated ${files.length} card(s) into ${OUT_DIR}/.`);

// `vite preview` serves .svelte-kit/output/client, not build/.
const previewClientDir = '.svelte-kit/output/client';
if (existsSync(previewClientDir)) {
	cpSync(OUT_DIR, join(previewClientDir, 'og'), { recursive: true });
}
