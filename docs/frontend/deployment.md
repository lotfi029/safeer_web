# safeer_web: deployment (VPS, Docker)

Production runs on the association's VPS as one Docker Compose project, `safeer`. The project is three
containers behind the VPS's existing edge Caddy, which already owns ports 80/443:

- `mysql:8.4`
- `safeer-api` (the NestJS API)
- `safeer-web` (this repo's SSR server)

**The stack is defined and run from safeer_api.** This document covers the frontend's part and the
settings where the two must agree.

- **Compose bundle:** `safeer_api/deploy/`: `docker-compose.yml`, the env templates, the Caddy blocks,
  `backup.sh`.
- **Runbook:** `safeer_api/docs/backend/DEPLOYMENT-VPS.md`:
  - first deploy, staging, cutover
  - updates and rollback
  - verification, including the client-IP checks
  - backups

## 1. Topology

```
visitor ─HTTPS─▶ Caddy (edge) ─▶ safeer-web:4000 ─▶ api:3900 ─▶ db:3306
                 TLS, sets XFF    TRUST_PROXY=1      TRUST_PROXY=1  mysql:8.4
                 [edge network]   [edge + safeer]    [safeer]       [safeer]
```

- **Only `safeer-web` is reachable, and only through Caddy.** No container publishes a port.
  - `safeer-web` joins the edge Caddy's Docker network under the alias `safeer-web`, plus the private
    `safeer` network.
  - The API and the database are on `safeer` only.
- **Everything is same-origin.** `/api/*` and `/files/*` go through this server's proxy (30 s upstream
  timeout), so there's no CORS and the session cookies are first-party.
- **SSR calls the API directly at `API_INTERNAL_URL=http://api:3900`, never through the public domain
  (B2).** Angular's server platform makes request URLs absolute on the request's host;
  `InternalApiBackend` rewrites both forms to the internal origin. This is what lets staging render
  while the real domain still points elsewhere.
- **Client IPs:**
  - Caddy keeps no `trusted_proxies`, so it replaces any `X-Forwarded-For` a client sends.
  - This server trusts one hop (`TRUST_PROXY=1`) and **overwrites** `X-Forwarded-For` for the API,
    on proxied calls and on SSR data calls alike.
  - The API also trusts one hop, so its rate limits and lockouts see the real visitor.
- **One instance of each.** The SSR server is stateless; the API's cache is in-process.

## 2. The image

- **Image:** `ghcr.io/lotfi029/safeer-web:<tag>`, built from `Dockerfile` by
  `.github/workflows/image.yml`. It's pushed on a `v*` tag, and `:sha-<short>` on every publish.
- **Build stage:** Node 24.21.0 (`.nvmrc`); `npm ci`, `npm run build`.
- **Runtime stage:** Node 24.21.0 slim with only `dist/safeer_web/`. The server bundle carries Express,
  the proxy and Angular, so there are **no `node_modules`**.
  - Runs as `node`.
  - `NODE_ENV=production HOST=0.0.0.0 PORT=4000`.
  - `HEALTHCHECK` on `/healthz`, which answers whatever the `Host` header is.
- **Every PR** builds the image in CI (`ci.yml` → `image`, `.github/scripts/check-image.sh`) and renders
  `/ar` and `/en` through it for a public host with no DNS (`https://safeer.test`).

## 3. Environment

Set in `safeer_api/deploy/docker-compose.yml` (service `web`). Anything extra goes in an optional
`web.env` next to it.

| Variable | Value in the stack | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Turns on strict env validation, HSTS and the production error page. |
| `PUBLIC_SITE_URL` | `${SITE_URL}` | The public origin. Host validation fails closed: only this host and its `www.` twin are accepted (anything else gets 400). It's also the base for canonical URLs, hreflang, the sitemap and robots.txt. |
| `API_INTERNAL_URL` | `http://api:3900` | The API on the private network. No `/api/v1` suffix. |
| `HOST` | `0.0.0.0` | The bind address (S2). It defaults to `127.0.0.1`, which suits a bare host behind a local proxy. In a container it must be `0.0.0.0`. |
| `PORT` | `4000` | What the Caddy block proxies to (`safeer-web:4000`). |
| `TRUST_PROXY` | `1` | One proxy (Caddy) in front of this server. A wrong value gives every visitor the proxy's IP, and then the API's per-IP limits apply to everyone at once. |

### Values that must agree with safeer_api

Compose derives all three URLs from one `SITE_URL` in `/srv/safeer/.env`, so they can't drift:

| safeer_api | must equal |
|---|---|
| `FRONTEND_BASE_URL` | `PUBLIC_SITE_URL` (invite, reset, portal and inbox links in mail/SMS are built from it) |
| `CORS_ORIGINS` | `PUBLIC_SITE_URL` (unused by the browser, since everything is same-origin, but set anyway) |
| `TRUST_PROXY=1` | this server's `TRUST_PROXY=1` (each trusts exactly the hop in front of it) |
| `PORT` (3900 in the image) | the port in `API_INTERNAL_URL` |
| `NODE_ENV=production` | both use HTTPS-only (`Secure`) cookies, so the site must be served over HTTPS |

## 4. Staging, then cutover

The runbook has the full steps. For this server it comes down to one variable and one Caddy block:

1. **Staging:**
   - `SITE_URL=https://new.safeer-sa.org` (or any staging name whose DNS points at the VPS)
   - the edge Caddy gets `Caddyfile.safeer.staging`
   - the real domain can keep pointing at the old site meanwhile: SSR never calls it (§1)
2. **Cutover**, once the apex and `www` DNS point at the VPS:
   - `SITE_URL=https://safeer-sa.org`, then `docker compose up -d` (recreates `api` and `web`)
   - swap the Caddy block for `Caddyfile.safeer.prod` (apex, and `www` → apex)
   - verify again

**Updates:**
1. Set the new `SAFEER_WEB_TAG` in `/srv/safeer/.env`.
2. `docker compose pull web && docker compose up -d web`.

The server keeps no state. On `SIGTERM` it stops accepting connections and exits within 8 s; compose
gives it 12 s. **Rollback:** the previous tag. Deploy the API first whenever its contract changes.

## 5. Verification

The full list is in `DEPLOYMENT-VPS.md` §4. The frontend-specific checks:

```bash
SITE=https://new.safeer-sa.org
curl -s $SITE/healthz                                   # {"status":"ok"}
curl -sI $SITE/ar | grep -i -E 'content-security-policy|strict-transport|cache-control'
curl -s $SITE/api/v1/site | head -c 200                 # through the proxy → API
curl -s $SITE/robots.txt ; curl -s $SITE/sitemap.xml | head
curl -sI $SITE/ar/admin | grep -i -E 'cache-control|x-robots'   # no-store, noindex
cd /srv/safeer && docker compose logs --tail=100 web | grep -i -E 'ENOTFOUND|UPSTREAM|MaxListeners'   # nothing
```

In a browser:
- the home page, a news article, the apply form up to step 1, and the admin login
- the console shows no CSP errors

## 6. Security decisions that constrain hosting

- **No shared HTML caching** (R2).
  - Every HTML response carries a fresh CSP nonce, so public HTML is `Cache-Control: no-cache` and
    admin/portal HTML is `no-store`.
  - The Caddy blocks add no caching, and none should be added for HTML, nor a CDN page cache.
  - Hashed static assets (`*-HASH.js/css`, fonts) are `immutable` for a year and may be cached anywhere.
  - If HTML ever has to be edge-cached, switch to hash-based CSP (`security.autoCsp`) first.
- **Headers** the SSR server sets:
  - nonce-based CSP, without `strict-dynamic`
    - `frame-src` allows only `https://www.google.com` and `https://www.openstreetmap.org`, the two
      contact-map hosts the API accepts
    - `img-src` is `self` and `data:`
    - `connect-src` is `self`
    - `frame-ancestors` is `none`
  - HSTS (production, `includeSubDomains`; see the runbook's cutover note), `nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: DENY`,
    `Cross-Origin-Opener-Policy`
  - `X-Robots-Tag: noindex, nofollow` on admin and portal

  e2e `security.spec.ts` checks these on every route type.
- **API down:**
  - Proxied calls answer `502 application/problem+json` (`UPSTREAM_UNAVAILABLE`), or `504`
    (`UPSTREAM_TIMEOUT`) after 30 s.
  - Public pages render their API-error state.
  - Uncaught server errors get the static 500 page (no scripts).
- **Body limits:** Caddy has none by default, which covers the API's 10 MB document uploads. This
  server streams request bodies (no body parser is mounted before the proxy).

## 7. Backups and monitoring

- **safeer_web keeps no data.** Its settings live in the stack's env files, which the API runbook's
  backup section covers, along with the database and the storage volume.
- **Uptime checks** on `https://<domain>/healthz` (this server) and `https://<domain>/api/v1/site`
  (this server + proxy + API + DB).
- **Logs:** `docker compose logs web`, JSON files rotated at 10 MB × 5. The server logs unhandled render
  errors, and proxy failures as `UPSTREAM_UNAVAILABLE` / `UPSTREAM_TIMEOUT`.
- **Memory:** `docker stats safeer-web-1`. PM2's `max_memory_restart` doesn't apply in Docker. S8 (a
  listener leak on keep-alive connections) is fixed; `node scripts/proxy-load.mjs` re-checks it.

## Appendix: non-Docker options

Kept for hosts without Docker. **Neither is used in production.**

- **`app.cjs`** is a CommonJS start file for runners that `require()` the entry, such as Hostinger's
  Node.js hosting (LiteSpeed `lsnode.js`). Loaded that way, the ESM bundle isn't the main module and
  would never listen. `app.cjs` sets `SAFEER_SSR_LISTEN=1` and imports
  `dist/safeer_web/server/server.mjs`. Set the start file to `app.cjs`.
- **`ecosystem.config.cjs`** is a PM2 process file: 1 instance, fork mode, `max_memory_restart: 400M`,
  `kill_timeout: 10000`, logs in `logs/`.
  ```bash
  pm2 start ecosystem.config.cjs --env production && pm2 save && pm2 startup
  ```
- **Environment:** values come from `.env` in the working directory (`.env.example`) or the host's
  environment, and an already-set variable wins.
  - Keep `HOST=127.0.0.1` behind a local proxy.
  - `API_INTERNAL_URL` is the API on loopback, e.g. `http://127.0.0.1:3900`.
  - The API must not be publicly reachable. Its own `HOST` (default `127.0.0.1`) covers that.
- **Build:** `npm ci && npm run build:ci` (production build + gzip budget + prod-artifact check). Deploy
  `dist/safeer_web/`, plus `app.cjs` or `ecosystem.config.cjs`.
