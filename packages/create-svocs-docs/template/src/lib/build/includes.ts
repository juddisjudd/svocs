import { existsSync, readFileSync } from 'node:fs';
import { posix, relative, resolve, sep } from 'node:path';
import GithubSlugger from 'github-slugger';
import type { PreprocessorGroup } from 'svelte/compiler';

type Load = (path: string) => string | undefined;

type ImportSpec = {
	from: string;
	relativeTo?: string;
	defaultName?: string;
	namespace?: string;
	named: { imported: string; local: string }[];
};

export type IncludeResult = { code: string; dependencies: string[]; errors: string[] };

const INCLUDE_RE = /<include>([^<]*)<\/include>/g;
const SCRIPT_OR_STYLE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g;
const INSTANCE_SCRIPT_OPEN_RE = /^<script(?![^>]*\b(?:module|context\s*=))[^>]*>/m;
const IMPORT_RE = /\bimport\s+([\w$\s{},*]+?)\s+from\s+(['"])([^'"]+)\2;?/g;
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

const blank = (text: string) => text.replace(/[^\r\n]/g, ' ');

/** Same-length copy of `text` with fenced code, inline code and HTML comments blanked out. */
function maskCode(text: string): string {
	let fence: string | null = null;
	const lines = text.split('\n').map((line) => {
		const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
		if (fence) {
			if (marker && marker[0] === fence[0] && marker.length >= fence.length) {
				fence = null;
			}
			return blank(line);
		}
		if (marker) {
			fence = marker;
			return blank(line);
		}
		return line.replace(/(`+).*?\1/g, blank);
	});
	return lines.join('\n').replace(/<!--[\s\S]*?-->/g, blank);
}

function parseImports(script: string): ImportSpec[] {
	const specs: ImportSpec[] = [];
	for (const [, clause, , from] of script.matchAll(IMPORT_RE)) {
		if (/^type\s/.test(clause.trim())) {
			continue;
		}
		const spec: ImportSpec = { from, named: [] };
		const braces = clause.match(/\{([^}]*)\}/);
		for (const part of braces?.[1].split(',') ?? []) {
			const [imported, local = imported] = part.trim().split(/\s+as\s+/);
			if (imported && !imported.startsWith('type ')) {
				spec.named.push({ imported, local });
			}
		}
		const rest = clause.replace(/\{[^}]*\}/, '').split(',');
		for (const part of rest.map((p) => p.trim()).filter(Boolean)) {
			const namespace = part.match(/^\*\s+as\s+([\w$]+)$/);
			if (namespace) {
				spec.namespace = namespace[1];
			} else {
				spec.defaultName = part;
			}
		}
		specs.push(spec);
	}
	return specs;
}

function localNames(spec: ImportSpec): string[] {
	return [spec.defaultName, spec.namespace, ...spec.named.map((n) => n.local)].filter(
		(name): name is string => Boolean(name)
	);
}

/** A content page without its frontmatter, script and style blocks, plus its script's imports. */
function splitPage(source: string): { body: string; imports: ImportSpec[] } {
	const withoutFrontmatter = source.replace(FRONTMATTER_RE, '');
	const masked = maskCode(withoutFrontmatter);
	const imports: ImportSpec[] = [];
	let body = '';
	let last = 0;
	for (const match of masked.matchAll(SCRIPT_OR_STYLE_RE)) {
		const block = withoutFrontmatter.slice(match.index, match.index + match[0].length);
		if (match[1] === 'script' && INSTANCE_SCRIPT_OPEN_RE.test(block)) {
			imports.push(...parseImports(block));
		}
		body += withoutFrontmatter.slice(last, match.index);
		last = match.index + match[0].length;
	}
	return { body: body + withoutFrontmatter.slice(last), imports };
}

function headingText(markdown: string): string {
	return markdown
		.replace(/\s+#+\s*$/, '')
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.trim();
}

/** The children of `<section id>`, or a heading and everything under it down to the next heading at its level or higher. */
export function extractSection(body: string, id: string): string | undefined {
	const masked = maskCode(body);

	for (const open of masked.matchAll(/<section\b[^>]*?\sid\s*=\s*(["'])(.*?)\1[^>]*>/g)) {
		if (open[2] !== id) {
			continue;
		}
		const start = open.index + open[0].length;
		let depth = 1;
		const tags = /<(\/?)section\b[^>]*>/g;
		tags.lastIndex = start;
		for (let tag = tags.exec(masked); tag; tag = tags.exec(masked)) {
			depth += tag[1] ? -1 : 1;
			if (depth === 0) {
				return body.slice(start, tag.index);
			}
		}
		return undefined;
	}

	const lines = body.split('\n');
	const maskedLines = masked.split('\n');
	const slugger = new GithubSlugger();
	let from = -1;
	let level = 0;
	for (let i = 0; i < lines.length; i += 1) {
		const heading = maskedLines[i].match(/^(#{1,6})\s/);
		if (!heading) {
			continue;
		}
		const depth = heading[1].length;
		if (from >= 0 && depth <= level) {
			return lines.slice(from, i).join('\n');
		}
		if (from < 0 && slugger.slug(headingText(lines[i].slice(depth))) === id) {
			from = i;
			level = depth;
		}
	}
	return from >= 0 ? lines.slice(from).join('\n') : undefined;
}

function usedIn(text: string, name: string): boolean {
	return new RegExp(`(^|[^\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(text);
}

function renderImport(spec: ImportSpec, from: string): string {
	const parts: string[] = [];
	if (spec.defaultName) {
		parts.push(spec.defaultName);
	}
	if (spec.namespace) {
		parts.push(`* as ${spec.namespace}`);
	}
	if (spec.named.length > 0) {
		const named = spec.named.map(({ imported, local }) =>
			imported === local ? imported : `${imported} as ${local}`
		);
		parts.push(`{ ${named.join(', ')} }`);
	}
	return `import ${parts.join(', ')} from '${from}';`;
}

/** Adds the imports included content relies on to the host page's script, skipping names it already binds. */
function addImports(code: string, imports: ImportSpec[], hostPath: string): string {
	const masked = maskCode(code);
	const open = masked.match(INSTANCE_SCRIPT_OPEN_RE);
	const close = open?.index === undefined ? -1 : masked.indexOf('</script>', open.index);
	const bound = new Set(
		open?.index === undefined ? [] : parseImports(code.slice(open.index, close)).flatMap(localNames)
	);

	const lines: string[] = [];
	for (const spec of imports) {
		const missing: ImportSpec = {
			from: spec.from,
			defaultName: spec.defaultName && !bound.has(spec.defaultName) ? spec.defaultName : undefined,
			namespace: spec.namespace && !bound.has(spec.namespace) ? spec.namespace : undefined,
			named: spec.named.filter(({ local }) => !bound.has(local))
		};
		const names = localNames(missing);
		if (names.length === 0) {
			continue;
		}
		names.forEach((name) => bound.add(name));
		let from = spec.from;
		if (spec.relativeTo) {
			from = posix.relative(
				posix.dirname(hostPath),
				posix.join(posix.dirname(spec.relativeTo), from)
			);
			from = from.startsWith('.') ? from : `./${from}`;
		}
		lines.push(`\t${renderImport(missing, from)}`);
	}
	if (lines.length === 0) {
		return code;
	}

	if (open?.index !== undefined) {
		const at = open.index + open[0].length;
		return `${code.slice(0, at)}\n${lines.join('\n')}${code.slice(at)}`;
	}
	const frontmatter = code.match(FRONTMATTER_RE)?.[0] ?? '';
	return `${frontmatter}<script>\n${lines.join('\n')}\n</script>\n\n${code.slice(frontmatter.length)}`;
}

/** Replaces each `<include>page.md</include>` or `<include>page.svx#id</include>` with that page or section's source. */
export function inlineIncludes(source: string, filePath: string, load: Load): IncludeResult {
	if (!source.includes('<include>')) {
		return { code: source, dependencies: [], errors: [] };
	}
	const dependencies = new Set<string>();
	const errors: string[] = [];
	const imports: ImportSpec[] = [];

	function expand(text: string, path: string, stack: string[]): string {
		let out = '';
		let last = 0;
		for (const match of maskCode(text).matchAll(INCLUDE_RE)) {
			out += text.slice(last, match.index);
			last = match.index + match[0].length;
			out += resolveInclude(match[0], match[1].trim(), path, stack) ?? match[0];
		}
		return out + text.slice(last);
	}

	function resolveInclude(
		tag: string,
		spec: string,
		path: string,
		stack: string[]
	): string | undefined {
		const [file, id] = spec.split('#');
		if (!/\.(md|svx)$/.test(file)) {
			errors.push(`${tag}: only .md and .svx pages can be included`);
			return undefined;
		}
		const target = posix.join(posix.dirname(path), file);
		const key = id ? `${target}#${id}` : target;
		if (stack.includes(key)) {
			errors.push(`${tag}: the page includes itself`);
			return undefined;
		}
		const raw = load(target);
		if (raw === undefined) {
			errors.push(`${tag}: no page at that path`);
			return undefined;
		}
		dependencies.add(target);

		const page = splitPage(raw);
		const section = id ? extractSection(page.body, id) : page.body;
		if (section === undefined) {
			errors.push(`${tag}: no <section id="${id}"> or heading with that id`);
			return undefined;
		}
		const used = maskCode(section);
		for (const pageImport of page.imports) {
			const relevant: ImportSpec = {
				from: pageImport.from,
				relativeTo: pageImport.from.startsWith('.') ? target : undefined,
				defaultName:
					pageImport.defaultName && usedIn(used, pageImport.defaultName)
						? pageImport.defaultName
						: undefined,
				namespace:
					pageImport.namespace && usedIn(used, pageImport.namespace)
						? pageImport.namespace
						: undefined,
				named: pageImport.named.filter(({ local }) => usedIn(used, local))
			};
			if (localNames(relevant).length > 0) {
				imports.push(relevant);
			}
		}
		return `\n${expand(section, target, [...stack, key]).trim()}\n`;
	}

	const expanded = expand(source, filePath, [filePath]);
	return {
		code: addImports(expanded, imports, filePath),
		dependencies: [...dependencies],
		errors
	};
}

/** Svelte preprocessor; list it before obsidian() and mdsvex. */
export function includes(options: { contentDir?: string } = {}): PreprocessorGroup {
	const contentDir = resolve(options.contentDir ?? 'content');
	return {
		name: 'svocs-includes',
		markup({ content, filename }) {
			if (!filename || !/\.(md|svx)$/.test(filename) || !content.includes('<include>')) {
				return undefined;
			}
			if (!resolve(filename).startsWith(contentDir + sep)) {
				return undefined;
			}
			const path = resolve(filename).split(sep).join('/');
			const result = inlineIncludes(content, path, (target) =>
				existsSync(target) ? readFileSync(target, 'utf8') : undefined
			);
			if (result.errors.length > 0) {
				const rel = relative(contentDir, filename).split(sep).join('/');
				throw new Error(result.errors.map((error) => `content/${rel}: ${error}`).join('\n'));
			}
			return { code: result.code, dependencies: result.dependencies };
		}
	};
}
