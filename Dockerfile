# syntax=docker/dockerfile:1
#
# safeer-web — the SSR server image for the VPS (safeer_api: deploy/docker-compose.yml and
# docs/backend/DEPLOYMENT-VPS.md). Built and pushed to ghcr.io/lotfi029/safeer-web by
# .github/workflows/image.yml; ci.yml's `image` job builds it on every PR and renders a page through it.
#
# The server bundle (dist/safeer_web/server/server.mjs) is self-contained: Angular, Express, compression
# and http-proxy-middleware are bundled into it (scripts/check-prod-artifact.mjs; review §1), so the
# runtime stage carries dist/safeer_web/ and nothing else, no node_modules.
# Both stages pinned to .nvmrc's Node version; bump them together.

# ---- build ---------------------------------------------------------------------------------------
FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Everything the production build reads (src/, public/, mocks/ for type-checking, the configs);
# .dockerignore keeps the rest out.
COPY . .
RUN npm run build

# ---- runtime -------------------------------------------------------------------------------------
FROM node:24.21.0-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000

COPY --from=build --chown=node:node /app/dist/safeer_web ./dist/safeer_web

USER node

EXPOSE 4000

# /healthz answers whatever the Host header is (it sits before Angular's host check). No curl in slim.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# node directly (not npm) so SIGTERM reaches server.ts, which closes the server and exits within 8 s.
CMD ["node", "dist/safeer_web/server/server.mjs"]
