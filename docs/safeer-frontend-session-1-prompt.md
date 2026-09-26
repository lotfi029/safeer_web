# Prompt — Session 1: Foundation + public product (Phases 0–6)

> Run Claude Code on the `safeer_web` repo and paste everything below the line.
> **If Phase 0 is already planned in the current session:** paste only the section "Phase 0 — approved with revisions" as your reply to that plan.

---

You are building **safeer_web**, the Angular 22 SSR frontend for **جمعية سفير الدعوية**. This is **Session 1 of 2**. You deliver Phases **0–6**: scaffold, foundations, the public site, news, the apply flow and the student portal. Session 2 (a fresh context) will build the admin dashboard and launch hardening on top of your work, so you must leave it a complete handoff.

## Read first, fully

1. `docs/safeer-frontend-sessions-plan.md` — Phase 0 review (R1–R11), the session split, and the handoff contract. **This overrides the base plan wherever they differ.**
2. `docs/safeer-frontend-implementation-prompt.md` — the full brief: stack, hard rules, per-phase notes. Everything in it applies, except that your scope ends at Phase 6.
3. `docs/safeer-frontend-plan.md` — architecture, routes, responsive rules, the screen→API map (§6.1–6.2), backend prerequisites (§9).
4. `docs/safeer-design-spec.md`, `docs/safeer-prototype.html` (screenshot the matching screen with Playwright before building it), `docs/safeer-logo.png`.
5. `docs/api/` — the API contract snapshot (see its README). If `safeer_api` is attached to this session, read it directly instead.

## Phase 0 — approved with revisions

Your Phase 0 plan is approved, including all 7 listed deviations and **Signal Forms** (keep typed Reactive Forms as the documented fallback). Apply these changes before executing. Full reasoning is in `docs/safeer-frontend-sessions-plan.md` Part A.

- **R1 CSP:**
  - `script-src 'self' 'nonce-X'` with **no `'strict-dynamic'`**.
  - `style-src-elem 'self' 'nonce-X'` + `style-src-attr 'unsafe-inline'`.
  - Add `frame-src 'none'`.
  - Nonce replacement also applies to the CSR shell served for `RenderMode.Client` routes.
  - The e2e test asserts zero CSP violations on `/ar`, `/ar/admin` and `/ar/portal`.
- **R2:** SSR HTML gets `Cache-Control: no-cache`, not `s-maxage`, because a per-request nonce can't sit behind a shared cache. Admin and portal keep `no-store` + `noindex`.
- **R3 client IP:**
  - Express `trust proxy` = `TRUST_PROXY` (default 1).
  - The proxy **overwrites** `X-Forwarded-For` with `req.ip` (don't append), and sets `X-Forwarded-Proto` and `X-Forwarded-Host`.
  - A server-only HttpClient interceptor sends `X-Forwarded-For: <client ip>` and `Accept-Language` on SSR-side API calls.
  - e2e covers both paths through the `__echo` route.
- **R4:** Node 24 is for build and CI. Document the Hostinger runtime Node version separately, and verify `server.mjs` runs on it.
- **R5:** `allowedHosts` = apex + `www` from `PUBLIC_SITE_URL`, plus localhost outside production. Fail closed in production.
- **R6:** The `/` 302 sends `Vary: Cookie` + `no-store`. An unknown lang returns 404. `/ar/` returns 301 to `/ar`.
- **R7:** Proxy uses `changeOrigin`, a 30s timeout, and no body parser in front of it. API down → 502 problem+json. SSR server exposes its own `GET /healthz`.
- **R8:** `provideHttpClient(withFetch(), withInterceptors([...]))` now. The transfer cache covers public GETs only (exclude `/admin`, `/portal` and credentialed requests).
- **R9:** `lint-styles` scans `src/**/*.{ts,html,css}` only. Hex values are allowed only in `src/styles/tokens.css`.
- **R10:** CI adds `concurrency` and a Playwright browser cache. e2e runs with `NODE_ENV=production`.
- **R11:** PM2 runs 1 instance in fork mode with `kill_timeout`, and `server.ts` shuts down gracefully on `SIGTERM`.

## Session 1 scope additions

Session 2 depends on these, so they are not optional:

- **Phase 1:** the UI kit must include the admin-grade components:
  - `data-table` (semantic table ≥ md, card list < md, row selection incl. mobile selection mode, sort, loading/empty states)
  - `dialog`, `drawer`, `tabs`, `pagination`, `filter-bar`, `file-drop` (progress + client validation), `toast`, `status-pill`, `skeleton`, `stepper`

  Every component goes on the dev-only `/_kit` page in all states, RTL/LTR and light/dark.
- **Phase 1:** the full core API layer:
  - interceptors: base-url, locale, CSRF, problem-details, credentials, XFF
  - `StaffSessionStore` + `staffGuard` / `roleGuard`, exercised by a stub `/:lang/admin/login` page and one guarded placeholder
  - `ApplicantSessionStore`
  - the mock framework behind `environment.useMocks`
- **Phase 1:** a reusable Playwright helper that runs a spec across 6 viewports × 2 locales and runs axe (serious/critical = fail).

## Working rules

- One phase at a time on branch `feat/phase-N`, opened as a **draft PR against `main`**. Never merge, never force-push, never modify `safeer_api`.
- After each phase, report:
  - results of `npm run lint`, `ng test`, `npm run test:server`, `ng build` + the gzip budget, and `npx playwright test`
  - screenshots at 390 and 1440 in ar and en, saved to `docs/frontend/screens/phase-N/`
  - which mocks are active
  - deviations from the plan

  Then **stop and wait for my OK**.
- Backend items not yet live (B1–B3, B9, B12, B15, B16) are coded to the agreed contract and mocked.

## Session exit (after Phase 6 is approved)

1. Write `docs/frontend/HANDOFF.md` exactly per the handoff contract (sessions plan, Part B), plus the as-built route list for Phases 0–6.
2. Final report: a table of every public and portal screen (plan §6.1–6.2) → route → API calls → test file → status.
3. Put `HANDOFF.md` in its own small PR, `docs/phase-6-handoff`.

Start with Phase 0 as revised above. Execute it, then stop and report.
