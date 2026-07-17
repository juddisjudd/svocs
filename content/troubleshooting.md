## Content that renders wrong

These all come from the same root cause: `.svx` compiles through [mdsvex](https://mdsvex.pngwn.io/), which parses your file as Markdown first and JSX-like syntax second. MDX (the React equivalent) is more forgiving about the boundary between the two; mdsvex is stricter, so patterns that work in MDX tutorials or copy-pasted examples can break here.

### A component's content shows up as a code block

```md
<Callout type="info">
    This text renders as code, not a callout body.
</Callout>
```

Four or more spaces of indentation is Markdown's code-block syntax, and mdsvex checks that before it checks for JSX children. Keep content flush against the left margin instead:

```md
<Callout type="info">

This renders correctly.

</Callout>
```

### A component's content doesn't render at all, or breaks the paragraph after it

mdsvex needs a blank line between a tag and the Markdown that follows it, and another blank line before the closing tag. No blank line means the parser treats the tag and your text as one inline unit and gives up on parsing the text as Markdown:

```md
<Callout type="info">
This won't render as expected.
</Callout>
```

Add the blank lines shown in the example above and it does.

### A heading with code containing a tag or brace fails the build

```md
## A heading with `<script>` or `{braces}` in it
```

Every page builds its table of contents from two independent passes over the same heading: one reads the raw Markdown text to compute a page's TOC links, the other reads the fully-rendered HTML to compute the actual heading's id. For plain text they agree. For inline code containing `<` or `{`, they don't — something about how the two passes handle a code span's contents diverges once a tag- or expression-like character is inside it, and prerendering fails with a "links to `#some-id`, but no element with that id exists" error. Plain inline code in a heading (no `<` or `{`) is unaffected, and inline code anywhere outside a heading is unaffected too — this is specifically a heading thing. Reword the heading to avoid the character, or drop the inline code formatting there:

```md
## A heading with script or braces in it
```

### JSX-style comments don't work

MDX's `{/* comment */}` syntax isn't parsed by mdsvex — outside a heading it just renders as literal text (`{/* comment */}`, backticks and all, if you'd wrapped it in inline code), which isn't what you meant. Use an HTML comment instead, which works everywhere including headings:

```md
<!-- this is a comment -->
```

### Bold or italic text inside raw inline HTML doesn't render

```md
<u>**this stays literal asterisks, not bold**</u>
```

mdsvex doesn't run Markdown parsing inside raw inline HTML elements like the one above — only Markdown syntax outside HTML, and JSX-like component syntax, get parsed. If you need styled inline text, use a component instead of raw HTML, or drop the wrapping element.

### A standalone line-break tag swallows the paragraph after it

```md
Some text here.
<br />
This paragraph disappears.
```

A self-closing tag like that on its own line opens an HTML block, and everything until the next blank line gets treated as part of that block instead of as Markdown. A blank line on its own gives the same spacing without the side effect.

## Build fails on prerender

### `Error: 404 ... /docs/some-page` (or similar) during `bun run build`

Every internal link gets crawled during the static build, and a link to a page that doesn't exist fails the build by default — this is intentional, not a bug: it catches broken links before they ship instead of after. Fix the link, or remove it if the target page is gone. If you're migrating from another framework, `svocs migrate` sets this behavior to a warning automatically (via `handleHttpError` and `handleMissingId` in `vite.config.ts`'s prerender config), since a migrated site can carry dead links the source framework never checked. You can add the same override by hand to any site if you'd rather warn on broken links than fail the build on them, but the default is deliberately strict.

### `Missing static/fonts/satoshi-*.woff2` fails OG card generation

The OG image generator needs those font files to render social preview cards. Run `npx svocs-cli doctor` to confirm exactly which ones are missing — a fresh scaffold includes them, so this usually means they were deleted or excluded from version control.

## When something's misconfigured, not broken

Most setup problems (an empty `SITE_URL`, a search backend missing its env vars, missing OG fonts, a `.svocs.json` manifest out of date) show up as warnings or errors from one command:

```sh
npx svocs-cli doctor
```

See the [CLI](/docs/cli) page for what it checks and what each finding means.

## Warnings that are safe to ignore

- mdsvex still generates its markdown wrapper modules with the pre-Svelte-5 module-context syntax internally, so `context="module"` deprecation warnings during `bun run dev` or `bun run build` are expected. They don't block builds, and there's no content-side fix for them.
- Pagefind prints "Did not find a `data-pagefind-body` element" during its indexing step. That's it telling you it's indexing the whole page body instead of a scoped region — exactly what SVOCS wants it to do, not an error.

## `svocs update` or `svocs migrate` fails to extract a package

Both fetch `create-svocs-docs` as a tarball and extract it with your system's `tar`. Windows 10+, macOS, and any mainstream Linux ship one; if extraction fails, confirm `tar` is on your `PATH`.
