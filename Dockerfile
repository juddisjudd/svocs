# syntax=docker/dockerfile:1

FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
# Mermaid diagrams render to static SVG at build time via a headless
# Chromium (see vite.config.ts) — `bun install` only pulls in the playwright
# npm package, not the browser binary itself. --with-deps also installs the
# OS-level libraries (fonts, libnss3, etc.) this base image doesn't ship,
# which the browser needs to actually launch.
RUN bunx playwright install --with-deps chromium

COPY . .
RUN bun run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
