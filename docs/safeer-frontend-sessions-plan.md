# Safeer Frontend — Phase 0 Review + Two-Session Split

**Applies to:** `safeer_web` · Angular 22.2 SSR · plan `docs/safeer-frontend-plan.md`
**Date:** 2026-09-26

---

## Part A — Review of the Phase 0 plan

**Verdict: approve with revisions.** The plan is well researched: flags and versions were checked against the real packages, it uses real test gates, and it lists its deviations honestly. All 7 of its deviations are accepted. Apply the revisions below before executing. R1–R3 are real bugs that would reach production.

### Accepted as proposed

- `--style=tailwind`
- Node 24 for the build
- The gzip-budget script
- **Signal Forms** (stable in v22). Keep typed Reactive Forms as the documented fallback if a Signal Forms gap blocks the 3-step apply form.
- A copied Lucide sprite
- Report-only CSP in dev
- The 302 from `/` in `server.ts`
- The `feat/phase-0` branch and a draft PR

### Required revisions

**R1 — CSP will break the app as written.**
- `'strict-dynamic'` makes browsers ignore `'self'`, so Angular's `<script type="module" src>` bundles (which carry no nonce) are blocked. Use `script-src 'self' 'nonce-X'` and drop `'strict-dynamic'`.
- SSR output contains `style="…"` attributes (NgOptimizedImage, host style bindings), and `style-src 'nonce-X'` blocks those. Add `style-src-attr 'unsafe-inline'`. Keep `style-src-elem 'self' 'nonce-X'`.
- The `__CSP_NONCE__` replacement must also run on the **CSR shell** that `RenderMode.Client` routes (admin/portal) get, not only on SSR output.
- Confirm the event-replay inline script and the critical-CSS loader carry the nonce.
- Add `frame-src 'none'` now. The contact-page map adds its one host in Phase 3.
- The e2e test must load a public page **and** `/ar/admin` and `/ar/portal`, and assert no CSP violations on each.

**R2 — Per-request nonce conflicts with shared HTML caching.**
- `public, s-maxage=60` lets a proxy or CDN (Hostinger LiteSpeed/CDN) serve one nonce to every visitor. The nonce then becomes public and CSP protection is void.
- Use `Cache-Control: no-cache` on SSR HTML, meaning browser revalidation and no shared caching. Speed comes from the API's own response cache.
- If edge caching is needed later, switch to hash-based CSP (`security.autoCsp`) at that point.

**R3 — Client IP gets lost. This breaks the backend rate limits.**
- The chain is visitor → Hostinger edge → SSR server → API.
- With `xfwd` appending, the API (`trust proxy 1`) takes the right-most `X-Forwarded-For`, which is the **edge IP**. All visitors then share one IP: 5 applications or OTP requests per hour for the whole site, and every `ip_hash` column records the same value.
- SSR-side API calls come from `127.0.0.1` with no XFF, so every render shares one bucket of the global limit (100/min).
- Fix, frontend-only:
  - Set Express `trust proxy` = `TRUST_PROXY` (edge hop count, default 1).
  - The proxy **overwrites** `X-Forwarded-For` with `req.ip`. Don't append.
  - The SSR `HttpClient` interceptor sends `X-Forwarded-For: <client ip>` and `Accept-Language` on every server-side API call.
  - Add e2e coverage through the mock `__echo` route for both paths.
- Deployment note: the API must bind to `127.0.0.1` or otherwise be reachable only from the SSR server. If it's public, clients can spoof XFF.

### Recommended revisions

- **R4 — Runtime Node on Hostinger.** The Node 24 requirement comes from the CLI, which is build-time only. Build in CI on Node 24 and deploy the `dist/` artifact. Check which Node versions Hostinger offers, and test `server.mjs` on that version. Separate the build and runtime Node versions in the README and `engines`.
- **R5 — `allowedHosts`.** Include the apex and `www` hosts from `PUBLIC_SITE_URL`, plus `localhost`/`127.0.0.1` outside production. Fail closed in production.
- **R6 — Redirect `/`.** Send `Vary: Cookie` + `Cache-Control: no-store` on the 302. `/fr`, or any lang other than ar/en, returns 404. Normalise a trailing slash (`/ar/` → `/ar`) with a 301.
- **R7 — Proxy robustness.**
  - `changeOrigin: true`, `proxyTimeout: 30s`, and no body parser mounted before the proxy.
  - If the API is down, return a `502 application/problem+json` response.
  - Add `GET /healthz` on the SSR server itself for PM2 and uptime checks, and make sure it doesn't collide with the proxied `/api/v1/health`.
- **R8 — HttpClient.** Wire `provideHttpClient(withFetch(), withInterceptors([]))` in Phase 0. Set `withHttpTransferCacheOptions` to cache public GETs only (exclude `/admin`, `/portal` and anything that sends credentials), so Phase 1 can't forget it.
- **R9 — `lint-styles` scope.** Scan `src/**/*.{ts,html,css}` only. Exclude `public/**` and SVG sprites (Lucide paths use no hex, but brand SVGs may). Hex values are allowed only in `src/styles/tokens.css`.
- **R10 — CI.** Add `concurrency` (cancel superseded runs) and cache Playwright browsers. Run e2e with `NODE_ENV=production`, so the enforcing CSP is what gets tested.
- **R11 — PM2.** `instances: 1`, fork mode, `NODE_ENV=production`, log paths, `kill_timeout` for graceful shutdown. `server.ts` handles `SIGTERM`.

### Backend note

No backend change is required for R3 if the SSR server overwrites XFF as above. Record in `docs/frontend/deployment.md` that `safeer_api` must keep `trust proxy = 1` and must not be exposed publicly.

---

## Part B — Two-session split

The 11 phases are split into two Claude Code cloud sessions of roughly equal size (~15.5 working days each). **Session 1** delivers everything a visitor or student touches. **Session 2** delivers the admin dashboard and launch hardening. They connect through `main` plus a written handoff file.

| | **Session 1 — Foundation + public product** | **Session 2 — Admin + launch** |
|---|---|---|
| Phases | 0 Scaffold (with R1–R11) · 1 Foundations · 2 Public shell · 3 Public pages · 4 News · 5 Apply flow · 6 Student portal | 7 Admin core · 8 Admin content · 9 Admin system · 10 Hardening + deploy |
| Est. | 1 + 3 + 1.5 + 4 + 1.5 + 2.5 + 2 = **15.5 d** | 5 + 5 + 2.5 + 3 = **15.5 d** |
| Branches | `feat/phase-0` … `feat/phase-6`, one draft PR each | `feat/phase-7` … `feat/phase-10`, one draft PR each |
| Entry | `main` has `CLAUDE.md` + `docs/` | All Session 1 PRs **merged to `main`**, `docs/frontend/HANDOFF.md` present |
| Exit | Public site, apply flow and portal complete at 6 viewports × 2 locales. `HANDOFF.md` written. | All 29 screens done. Full QA matrix, axe and Lighthouse passing. Deployment notes. Final FR table. |
| Backend needed (else mocked) | B9 (button URLs), B12 (board bio), B15 (sitemap), B1–B3 + B16 (OTP, uploads, portal CSRF) | B7 (assignees), B10 (section count), B11 (item visibility), B8 (delete roles) |

### Scope moved into Session 1

Session 2 starts from a fresh context, so anything shared must already exist and be documented.

- **Shared UI kit, complete in Phase 1**, including the admin-grade pieces:
  - `data-table` (table ↔ card list, selection, sort, empty/loading states)
  - `dialog`, `drawer`, `tabs`, `pagination`, `filter-bar`, `file-drop` (with progress), `toast`, `status-pill`, `skeleton`, `stepper`
  - All shown on the `/_kit` page.
- **Core API layer:**
  - interceptors: base URL, locale, CSRF, problem-details, credentials, and the XFF interceptor from R3
  - `StaffSessionStore` skeleton + `staffGuard` / `roleGuard` (used first by a stub `/:lang/admin/login` page)
  - `ApplicantSessionStore`
  - the mock framework behind `environment.useMocks`
- **The Playwright viewport × locale matrix runner and the axe helper**, reused unchanged by Session 2.

### Handoff contract: `docs/frontend/HANDOFF.md`

Session 1 writes this as its last step, and Session 2 reads it first. It must contain:

1. **As-built architecture** and every deviation from the plan, with the reason for each.
2. **UI kit inventory:** component → selector → key inputs/outputs → where it's demoed on `/_kit`.
3. **API layer:** services, stores, interceptors. How to add an endpoint and a mock.
4. **Conventions:** folders, naming, i18n key scheme, Signal Forms patterns (autosave, field errors), SEO service usage, reveal/motion helpers, RTL rules and lint scripts.
5. **Test tooling:** unit and server test commands, the e2e matrix helper, fixtures, the screenshot path convention.
6. **Status:** which backend items are live vs mocked, open TODOs, known issues, anything the client still has to provide (logo SVG, numbers, photos, partners).
7. **Commands:** setup, dev, build, test, e2e, and the CI job list.

### Rules for both sessions

- One phase at a time. Stop after each phase and wait for approval.
- Each phase report includes: lint, unit, build, e2e results; screenshots at 390 and 1440 in ar and en, saved to `docs/frontend/screens/phase-N/`; the active mocks; and deviations.
- Never merge PRs yourself, never force-push `main`, never modify `safeer_api` from these sessions.
- **Between sessions:** you merge all Session 1 PRs, then refresh `docs/api/` if the backend contract changed (the backend fix prompt may have landed in the meantime).
