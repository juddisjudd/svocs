## Content pipeline

`Markdown -> transform -> compile -> page map`.

SVOCS currently uses mdsvex for markdown compilation and a small content registry for routing and sidebar navigation.

## Theme boundary

Themes render the page-map and content components. They do not own parsing or route generation.

## Routing

Docs are served from `/docs/*` via an optional catch-all route, and prerendered with `adapter-static`.
