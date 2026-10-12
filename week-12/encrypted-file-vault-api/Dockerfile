# The API as a container image.
#
#   bun run build                                          # 1. bundle src/ + dependencies into dist/main.js
#   docker build -t vault-api .                            # 2a. an image for your own machine (to try it)
#   docker build --platform linux/amd64 -t <registry>.azurecr.io/vault-api:1.0 .
#                                                          # 2b. an image for Azure (amd64); push it, don't run it on an ARM Mac
#
# Running it locally needs different service URLs than .env: inside a container
# "localhost" is the container itself. See "Running the container locally" in
# the week 12 README.
#
# `bun build` bundles the application *and* every dependency (jose, the Azure
# SDK) into one JavaScript file, so the image needs no node_modules, no
# package.json and no install step: just Bun and that file.

FROM oven/bun:1.4-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY dist/ ./dist/

# Do not run as root. The official image provides an unprivileged "bun" user.
USER bun

# Documentation only: the app listens on $PORT (default 8000).
EXPOSE 8000

CMD ["bun", "dist/main.js"]
