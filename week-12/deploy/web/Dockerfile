# The web server image: Caddy, its configuration and the built React app.
#
# prepare.ts copies this folder into deploy/out/web/ and adds client/ (the
# output of the client's `bun run build`). Baking the files into the image,
# instead of mounting them from the server's disk, means `docker compose up
# -d --build` always replaces them as one unit, like the API image.

FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY client/ /srv/client/
