# safeer_web — deployment notes (Hostinger Node.js app)

> Phase 0 notes. The full Hostinger runbook is completed in Phase 10.

## Build vs runtime Node (sessions plan R4)

- **Build and CI:** Node **24.21.0** (`.nvmrc`). The Angular 22.2 CLI refuses to run below Node 22.22.3 / 24.15.
- **Runtime:** only the build output is deployed. `dist/safeer_web/server/server.mjs` bundles Express, the proxy
  and Angular, so the server needs no `node_modules`. Verified in Phase 0 on **Node 22.22.2** and **24.21.0**
  (a copy of `dist/safeer_web/` alone, served `/ar` = 200). Node 20 is end-of-life and not supported.
- **To confirm in hPanel:** which Node versions the Hostinger plan offers. Select 24.x if available, else 22.x.

## Process

```bash
npm ci && npm run build              # in CI or locally, Node 24
# deploy dist/safeer_web/, ecosystem.config.cjs and .env to the app directory
pm2 start ecosystem.config.cjs --env production
pm2 save
```

- `ecosystem.config.cjs`: 1 instance, fork mode, `NODE_ENV=production`, `kill_timeout: 10000`, logs in `logs/`.
- `server.ts` handles `SIGTERM`/`SIGINT`: stops accepting connections, closes idle ones, force-exits after 8 s.
- Health check: `GET /healthz` → `{"status":"ok"}` (the SSR server itself; `/api/v1/health` is the API).

## Environment

| Variable | Required in production | Notes |
|---|---|---|
| `API_INTERNAL_URL` | yes | e.g. `http://127.0.0.1:3000`. No `/api/v1` suffix. |
| `PUBLIC_SITE_URL` | yes | e.g. `https://safeer-sa.org`. The server refuses to start without it (host validation fails closed). |
| `PORT` | no (4000) | |
| `TRUST_PROXY` | no (1) | Number of reverse proxies in front of the SSR server (Hostinger edge = 1). |

Values come from `.env` next to the app (loaded at start-up; never committed) or from the hPanel environment.

## Security decisions that constrain hosting

- **No shared HTML caching** (R2). Every HTML response carries a fresh CSP nonce, so public HTML is
  `Cache-Control: no-cache` and admin/portal HTML is `no-store`. Do not enable LiteSpeed/CDN page caching for HTML.
  Hashed static assets (`*-HASH.js/css`) are `immutable` for a year and may be cached anywhere.
  If edge caching of HTML is ever required, switch to hash-based CSP (`security.autoCsp`) first.
- **Client IP** (R3). The chain is visitor → Hostinger edge → SSR server → API.
  - The SSR server resolves the client IP with Express `trust proxy = TRUST_PROXY` and **overwrites**
    `X-Forwarded-For` with it on proxied `/api/*` and `/files/*` requests; SSR-side API calls send the same header.
  - `safeer_api` must keep `trust proxy = 1` (it trusts only the SSR server) and must **bind to `127.0.0.1`**
    (or otherwise be unreachable from the internet). If the API is public, clients can spoof `X-Forwarded-For`
    and bypass its rate limits.
- **Headers** set by the SSR server: nonce-based CSP (no `strict-dynamic`; `frame-src` allows only `https://www.google.com` and `https://www.openstreetmap.org`, the contact-map hosts, A12), HSTS
  (production), `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`,
  `Cross-Origin-Opener-Policy`. Admin/portal also get `X-Robots-Tag: noindex, nofollow`.
- **API down:** proxied calls answer `502 application/problem+json` (`UPSTREAM_UNAVAILABLE`), 30 s proxy timeout.
