# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the React/Vite frontend into static files.
# ---------------------------------------------------------------------------
FROM oven/bun:1.4.0 AS web-build
WORKDIR /web
COPY web/package.json ./
RUN bun install
COPY web/ ./
RUN bun run build

# ---------------------------------------------------------------------------
# Stage 2: runtime — Bun server that serves the API and the built SPA.
# ---------------------------------------------------------------------------
FROM oven/bun:1.4.0 AS runtime
WORKDIR /app/server

# Install server dependencies first (better layer caching).
COPY server/package.json ./
RUN bun install

# Server source, shared schema, and the built frontend.
COPY server/ ./
COPY db/ /app/db/
COPY --from=web-build /web/dist /app/web/dist

ENV NODE_ENV=production
ENV STATIC_DIR=/app/web/dist
EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
