# safeer_web: deployment runbook (Hostinger)

This runbook deploys the Angular SSR frontend (`safeer_web`) next to the NestJS API (`safeer_api`) on
Hostinger. The API has its own runbook, `safeer_api/docs/backend/DEPLOYMENT-HOSTINGER.md`, which covers
the database, migrations, storage, SMS/S3, retention and its backups. This document covers the
frontend, and the settings where the two must agree.

Items marked **[confirm]** depend on the Hostinger plan or the client's decisions and must be checked
on the first deploy.

## 1. Topology

```
visitor ──HTTPS──▶ Hostinger edge (LiteSpeed) ──▶ safeer_web SSR (Node, PORT)
                                                    │  /api/*, /files/*  (proxy, 30 s timeout)
                                                    │  SSR data calls
                                                    ▼
                                        safeer_api (Node, 127.0.0.1:API_PORT) ──▶ MariaDB 127.0.0.1:3306
```

- **Only the SSR server is public.** The browser never calls the API directly. `/api/*` and `/files/*`
  go through the SSR server's proxy, so everything is same-origin: no CORS, and the session cookies are
  first-party.
- **The API must not be reachable from the internet.** It trusts one proxy hop (`trust proxy = 1`) and
  rate-limits by the client IP in `X-Forwarded-For`. The SSR server **overwrites** that header with the
  real client IP, which it resolves with `TRUST_PROXY`. If the API were public, a client could send its
  own `X-Forwarded-For` and get around the API's rate limits and lockouts.
  - rc1's `main.ts` calls `app.listen(PORT)` without a host, so the API listens on every interface.
    This is backend follow-up **BF-4** (a `HOST` variable, defaulting to `127.0.0.1`). Until that
    ships, the API's port must be closed to the outside:
    - on a **VPS**, firewall the port (`ufw deny <API_PORT>`) or put the API behind nothing but loopback;
    - on **Node.js web hosting**, do not attach a domain or subdomain to the API app. **[confirm]**
      that Hostinger lets a Node.js app run without a public domain and reach another app on
      `127.0.0.1`. If it doesn't, the API has to go on a VPS, or share the frontend's Node process.
      That is a hosting decision for the client.
- One instance of each process (fork mode). The SSR server is stateless. The API's response cache is
  in-process (see its runbook).

## 2. Node versions

- **Build and CI:** Node **24.21.0** (`.nvmrc`). The Angular 22.2 CLI refuses to run below
  Node 22.22.3 / 24.15.
- **Runtime:** only the build output is deployed. `dist/safeer_web/server/server.mjs` bundles Express,
  the proxy and Angular, so the server needs no `node_modules`. It was verified on **Node 22.22.2** and
  **24.21.0**. Node 20 is end-of-life and not supported.
- In hPanel, select **24.x** if it is offered, otherwise 22.x. **[confirm]**

## 3. Build and artifact

```bash
npm ci
npm run build:ci        # production build + gzip budget + prod-artifact check (+ the e2e build)
```

The build and the budget checks run in CI on every PR. The deployable artifact is:

| Path | What |
|---|---|
| `dist/safeer_web/` | `browser/` (hashed static assets) + `server/` (SSR bundle) |
| `app.cjs` | CommonJS start file for runners that `require()` the entry (Hostinger `lsnode.js`) |
| `ecosystem.config.cjs` | PM2 process file (VPS, or any host where you run PM2 yourself) |
| `.env` | written on the server, never committed (§4) |

`scripts/check-prod-artifact.mjs` fails the build if the production bundle contains the mock backend or
the dev-only `/_kit` route.

## 4. Environment

### safeer_web

| Variable | Required in production | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production`. It turns on strict env validation, HSTS and the production error page. |
| `PUBLIC_SITE_URL` | yes | The public origin, e.g. `https://<domain>` **[client: domain]**. Host validation fails closed: the server refuses to start without it, and only accepts this host and its `www.` twin. It is also the base for canonical URLs, hreflang, the sitemap and robots.txt. |
| `API_INTERNAL_URL` | yes | The API's origin on loopback, e.g. `http://127.0.0.1:3900`. No `/api/v1` suffix. |
| `PORT` | no (4000) | The port the SSR server listens on. On Hostinger Node.js hosting, use the port the panel gives the app. |
| `TRUST_PROXY` | no (1) | The number of reverse proxies in front of the SSR server. Hostinger's edge counts as 1. Behind Cloudflare **and** Hostinger, it is 2. A wrong value gives every visitor the proxy's IP, and then the API's per-IP limits apply to everyone at once. |

Values come from `.env` in the working directory (loaded at start-up) or from the panel's environment
screen. The panel wins, because `.env` never overrides a variable that is already set.

### Values that must agree with safeer_api

| safeer_api | must equal |
|---|---|
| `PORT` | the port in `API_INTERNAL_URL` |
| `FRONTEND_BASE_URL` | `PUBLIC_SITE_URL` (invite, reset, portal and inbox links in mail/SMS are built from it) |
| `CORS_ORIGINS` | `PUBLIC_SITE_URL` (unused by the browser, since everything is same-origin, but set it anyway) |
| `NODE_ENV=production` | both use HTTPS-only (`Secure`) cookies, so the site must be served over HTTPS |

## 5. Starting the server

**Hostinger Node.js app (LiteSpeed `lsnode.js`)**
- Upload or deploy `dist/safeer_web/`, `app.cjs` and `package.json`. Set the **start file to `app.cjs`**.
- Leave the build command empty when you upload a built artifact. Otherwise use `npm ci && npm run build`,
  and note the API runbook's `.npmrc include=dev` caveat, which applies here too: the build needs
  devDependencies.
- Why `app.cjs`: `lsnode.js` `require()`s the start file. Loaded that way, the ESM server bundle is not
  the "main module", so it would never call `listen`. `app.cjs` sets `SAFEER_SSR_LISTEN=1` and imports
  the bundle. **[confirm]** on the first deploy: `/healthz` answers (§7).

**VPS / PM2**

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup          # once: restart on reboot
```

- `ecosystem.config.cjs`: 1 instance, fork mode, `max_memory_restart: 400M`, `kill_timeout: 10000`,
  logs in `logs/` with timestamps.
- `server.ts` handles `SIGTERM`/`SIGINT`: it stops accepting connections, closes idle ones, and
  force-exits after 8 s, which is shorter than PM2's 10 s `kill_timeout`.
- Put log rotation on `logs/` (`pm2 install pm2-logrotate`).

## 6. Deploy order, updates and rollback

**First deploy**
1. Deploy the API per its runbook: database, `npm run migrate`, the least-privilege DB user,
   `STORAGE_ROOT`, env, start. Check `curl http://127.0.0.1:<API_PORT>/health`.
2. Write the frontend's `.env` (§4), deploy the artifact, and start it (§5).
3. Point the domain at the frontend app, and enable HTTPS (Hostinger SSL). Redirect the `www.` host to
   the apex, or the other way round, in the panel.
4. Run the checks in §7.
5. Sign in at `/ar/admin/login` with the API's `BOOTSTRAP_ADMIN_EMAIL`, then:
   - configure mail (`/admin/system/mail`, then **Send test**) and, once the account exists, SMS
   - fill in the settings (`/admin/system/settings`): contact details, map, socials
   - invite the staff (`/admin/system/users`)

**Updates.** Deploy the API first whenever its contract changes. The frontend in this repo targets
`v1.0.0-rc1` (`docs/api/`). Then deploy the frontend, and restart it (`pm2 reload safeer-web`, or
restart from the panel). The SSR server keeps no state, so a restart only drops in-flight requests.

**Rollback.** Keep the previous `dist/safeer_web/` (e.g. `releases/<git-sha>/`), point the start file at
it, and restart. Hashed asset names mean old and new bundles never collide. Roll back the API
separately, per its runbook, and only if a migration requires it.

## 7. Verification

```bash
curl -s https://<domain>/healthz                      # {"status":"ok"} (SSR server)
curl -sI https://<domain>/ar | grep -i -E 'content-security-policy|strict-transport|cache-control'
curl -s https://<domain>/api/v1/site | head -c 200   # through the proxy → API
curl -s https://<domain>/robots.txt ; curl -s https://<domain>/sitemap.xml | head
curl -sI https://<domain>/ar/admin | grep -i -E 'cache-control|x-robots'   # no-store, noindex
```

- From a machine outside the server, the API port must **not** answer:
  `curl -m 5 http://<server-ip>:<API_PORT>/health` should time out or be refused.
- In a browser: the home page, a news article, the apply form up to step 1, and the admin login. The
  console must show no CSP errors.

## 8. Security decisions that constrain hosting

- **No shared HTML caching** (R2). Every HTML response carries a fresh CSP nonce, so public HTML is
  `Cache-Control: no-cache` and admin/portal HTML is `no-store`. **Do not enable LiteSpeed Cache, or a
  CDN page cache, for HTML.** Hashed static assets (`*-HASH.js/css`, fonts) are `immutable` for a year
  and may be cached anywhere. If HTML ever has to be edge-cached, switch to hash-based CSP
  (`security.autoCsp`) first.
- **Headers** the SSR server sets:
  - nonce-based CSP, without `strict-dynamic`
    - `frame-src` allows only `https://www.google.com` and `https://www.openstreetmap.org`, the two
      contact-map hosts the API accepts
    - `img-src` is `self` and `data:`
    - `connect-src` is `self`
    - `frame-ancestors` is `none`
  - HSTS (production), `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
    `Permissions-Policy`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy`
  - `X-Robots-Tag: noindex, nofollow` on admin and portal

  e2e `security.spec.ts` checks these on every route type.
- **API down:** proxied calls answer `502 application/problem+json` (`UPSTREAM_UNAVAILABLE`), and public
  pages render their API-error state. Uncaught server errors get the static 500 page (no scripts).

## 9. Backups

- **safeer_web keeps no data.** The only thing to keep is its `.env`, in the same password manager as
  the API's secrets. The build can always be recreated from git.
- **Everything that matters is in the API.** Follow its runbook's *Backups* section:
  - a daily `mysqldump` (03:30, 14 days)
  - a daily `backup:storage` tarball of `STORAGE_ROOT` (03:45, 14 days), which covers media and
    applicants' private documents
  - an offsite encrypted copy
  - **`APP_ENCRYPTION_KEY`**: without it, a restored database can't decrypt the stored SMTP/SMS
    secrets or applicant ID numbers
- Test a restore once before launch.

## 10. Monitoring

- Uptime checks on `https://<domain>/healthz` (frontend) and on `https://<domain>/api/v1/site`
  (frontend + proxy + API + DB).
- Logs: `logs/safeer-web.{out,err}.log` under PM2, or the runtime log in the panel. The SSR server logs
  unhandled render errors, and proxy failures as `UPSTREAM_UNAVAILABLE`.
- The API's audit log is at `/admin/system/audit`. Mail and SMS delivery logs are under
  `/admin/system/mail` and `/admin/system/sms` (**Log** tab).

## 11. Owed by the client before launch

- The domain, and DNS access **[client]**
- The Hostinger plan details: Node versions, and whether two Node apps can talk over loopback (§1)
  **[confirm]**
- Photos (the official logo SVG has been received)
- Impact numbers, partners, board and other content, entered through the admin screens (the seed has
  `[...]` placeholders)
- The SMS provider account (Unifonic), and SMTP credentials for mail
