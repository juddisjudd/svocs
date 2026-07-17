# syntax=docker/dockerfile:1

FROM oven/bun:1 AS build
WORKDIR /app

# git supplies the per-page "Last updated on" dates at build time; the
# safe.directory setting keeps it from refusing the copied-in repo.
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN git config --global --add safe.directory /app && bun run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
