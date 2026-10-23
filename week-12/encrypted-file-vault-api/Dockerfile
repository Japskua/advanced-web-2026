# The API as a container image.
#
#   bun run build                    # 1. bundle src/ + dependencies into dist/main.js
#   docker build -t vault-api .      # 2. build the image
#
# You rarely run these two by hand: week-12/deploy/prepare.ts puts the bundle
# and this Dockerfile into the deployment folder, and `docker compose up
# --build` on the server builds the image there, for the server's own CPU
# architecture (x86 or ARM).
#
# `bun build` bundles the application *and* every dependency (here: Elysia,
# its CORS plugin and jose) into one JavaScript file, so the image needs no
# node_modules, no package.json and no install step: just Bun and that file.

FROM oven/bun:1.4-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY dist/ ./dist/

# Do not run as root. The official image provides an unprivileged "bun" user.
USER bun

# Documentation only: the app listens on $PORT (default 8000).
EXPOSE 8000

# Docker asks this every 15 seconds; Compose starts Caddy only once the API is
# healthy, and `docker compose ps` shows the state.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://localhost:8000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["bun", "dist/main.js"]
