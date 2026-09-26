# Prompt — Build the Safeer frontend (Angular 22 · SSR · responsive)

> Run Claude Code (cloud or local) on the `safeer_web` repo and paste everything below the line. All referenced files are committed in the repo under `docs/`. If you can, also add `safeer_api` to the same session as a second repo.

---

You are building **safeer_web**, the public site, student portal and admin dashboard for **جمعية سفير الدعوية**. It is a Saudi non-profit that supports international scholarship students at Saudi universities. The backend already exists in the sibling repo `safeer_api` (NestJS, `/api/v1`, cookie sessions + CSRF, `openapi.json` at its root).

## Inputs — read all of these fully before writing code

1. `docs/safeer-frontend-plan.md` — **the plan you are implementing.** It holds the architecture, routing, responsive rules, screen-to-API map, phases and backend prerequisites. Follow it. If something in it turns out to be wrong for Angular 22.x, tell me, propose the change, and wait for my answer.
2. `docs/safeer-design-spec.md` — exact design values (hex colours, type scale, radii, heights, motion timings). Use them literally.
3. `docs/safeer-prototype.html` — the clickable prototype with 29 screens. Open it in a browser (Playwright) and screenshot the matching screen before building each one.
4. The API contract:
   - If `safeer_api` is attached to the session, read its `openapi.json`, controllers and `public-*.ts` mappers directly.
   - Otherwise use the snapshot in `docs/api/`: `openapi.json` for requests, and `docs/api/src/**` (the response mappers, transition map, timeline, apply-form schema and overview service) for response shapes, because the OpenAPI file declares no response schemas.
   - If the snapshot looks older than what the backend fix prompt promises, code to the fix prompt and mock the difference.
5. `docs/safeer-logo.png` — temporary logo. The official SVG is still pending, so leave a TODO and never ship an SVG you traced yourself.

## Repo rules

- This repo (`safeer_web`) already contains `docs/`, `CLAUDE.md` and a README. Scaffold Angular **into the repo root** (`ng new safeer_web --directory . …`) without deleting or overwriting `docs/` or `CLAUDE.md`. You may replace the README with a short technical one.
- **Keep `docs/` committed.** Cloud sessions depend on it. Deployment notes go in `docs/frontend/`.
- Never modify `safeer_api` from this session. Backend changes belong to `docs/safeer-backend-fix-prompt.md`, which runs in a `safeer_api` session.
- Commit at the end of each phase with a clear message. Don't push until I say so.

## Stack (fixed)

- Angular **22.x latest stable**: standalone components, **zoneless**, signals, `@if/@for/@defer`, `@angular/ssr` with Express, route render modes (`RenderMode.Server` for public, `RenderMode.Client` for `/:lang/portal/**` and `/:lang/admin/**`), `provideClientHydration(withIncrementalHydration(), withEventReplay())`.
- Tailwind CSS 4, with CSS variables from the spec. **Only CSS logical properties** (no `left/right/ml/mr` utilities). Angular CDK for a11y, overlay, dialog, drag-drop and layout. **No Angular Material.**
- Transloco with bundled TS translation objects for UI strings. Content language comes from the API via `?lang=` + `Accept-Language`.
- Typed Reactive Forms. Use Signal Forms only if the installed v22 marks them stable (check the Angular docs and tell me what you found).
- Vitest for unit tests, Playwright + `@axe-core/playwright` for e2e, a11y and viewport screenshots.
- Before scaffolding, check the current Angular CLI flags (`ng new --help`) and the v22 SSR docs. Use the real flags, not remembered ones.

## Hard rules

1. **No invented content.** Every text, number, name and image comes from the API or from `design-spec.md`. Missing values render as `[...]` / `[—]`. Image slots render as labelled placeholders `[صورة: ...]`.
2. **Responsive is part of every screen, not a final pass.** Each screen must work at 360, 390, 768, 1024, 1440 and 1920 in both `ar` (RTL) and `en` (LTR):
   - no horizontal scroll
   - touch targets ≥ 44px
   - tables become card lists below 768
   - admin sidebar becomes a drawer below 1024
   - `NgOptimizedImage` with a `srcset` from the API image variants (`thumb`/`card`/`full`) and explicit width/height
3. **SSR correctness:**
   - Public pages render complete HTML with the right `<html lang dir>`, title, meta, canonical, `hreflang` and JSON-LD.
   - No browser API outside `afterNextRender` / `isPlatformBrowser`.
   - Scroll-reveal must never leave content invisible in the SSR output.
   - A 404 returns HTTP 404.
   - The HTTP transfer cache is used only for public GETs, never for cookie-authenticated calls.
4. **Same-origin API:**
   - The Express `server.ts` proxies `/api/*` and `/files/*` to `API_INTERNAL_URL`, forwarding cookies, `X-Forwarded-For` and `Accept-Language`.
   - SSR-side HttpClient calls `API_INTERNAL_URL` directly.
   - Browser calls use the relative `/api/v1`.
   - `X-CSRF-Token` is sent on every non-GET request that has a session.
5. **Accessibility:**
   - Real `<a>`, `<button>` and `<label>` elements. `aria-label` on every icon-only button. Visible focus. Focus trap in dialogs.
   - Keyboard alternatives for every drag-and-drop action.
   - Contrast ≥ 4.5:1.
   - No clickable `div`/`span`, enforced by angular-eslint template a11y rules set to error.
6. **Security:**
   - Nonce-based CSP, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` from `server.ts`.
   - `no-store` on admin and portal HTML. `noindex` on admin and portal.
   - Never use `innerHTML` except for the API's already-sanitized article body, and pass that through Angular's sanitizer too.
7. **Performance budgets** in `angular.json`: initial public bundle < 150 KB gzip. Fail the build on budget errors.
8. **Motion** follows spec §2 exactly, and every animation stops under `prefers-reduced-motion`.

## Phases

Follow plan §8. After each phase:

- run `ng lint`, `ng test`, `ng build` and the Playwright suite for the screens built so far
- save screenshots at 390 and 1440 in ar and en into `docs/frontend/screens/phase-N/` (committed; PNG, keep each under 500 KB)
- report what was done, what deviates from the plan and why, and any backend gaps you hit
- **stop and wait for my OK**

### Backend prerequisites

The portal CSRF fix (`csrfToken` on `GET /portal/me`) is item **B16** in `docs/safeer-backend-fix-prompt.md`, together with every other backend item in plan §9. Those run in a separate `safeer_api` session. Here:

- code against the agreed contract, with mocks behind `environment.useMocks`
- list which mocks are still active in each phase report

### Phase-specific notes

- **Phase 0:**
  - Scaffold with SSR + zoneless.
  - Write the `server.ts` proxy and security headers.
  - PM2 `ecosystem.config.cjs`.
  - `.env` handling (`API_INTERNAL_URL`, `PUBLIC_SITE_URL`, `PORT`).
  - CI workflow: lint → unit → build → start API mock or real API → e2e.
- **Phase 1:**
  - Build the shared UI kit first, and make each component work in RTL and LTR, light and dark, at xs and xl.
  - Build a hidden dev-only `/_kit` route that shows every component in every state, so screens don't need to be reviewed one by one.
  - Exclude `/_kit` from production builds.
- **Phase 2:** also handle the legacy WordPress paths in `server.ts` (look up `/api/v1/redirects/resolve`, return 410 for the `doctor`/`appointment`/`cart`/medical-category families) and `sitemap.xml` / `robots.txt`.
- **Phase 3:** render the home page sections by `sectionKey` in API order, and skip unpublished ones. Button URLs from the API are locale-agnostic (`/apply`), so prefix them with the current `/:lang`.
- **Phase 5:**
  - Autosave with a 1.5s debounce and an `aria-live` "saved" indicator.
  - If the network fails, keep a local draft copy (wrapped in try/catch storage) and retry.
  - Client-side file checks (PDF/JPG/PNG, ≤ 5 MB) that match the backend.
- **Phase 7:** copy the status-transition map from `safeer_api/src/admin-applications/transitions.ts` (snapshot: `docs/api/src/admin-applications/transitions.ts`) into a shared constant with a unit test that fails if the two drift. Take the role matrix from `GET /admin/roles` at runtime. Never hard-code it into menus.
- **Phase 8:** build one config-driven `CrudList` + `CrudForm` pair (bilingual field pairs shown side by side on lg and as tabs on mobile, reorder with drag-drop + keyboard, publish toggle), then configure each content screen with it rather than hand-writing seven near-identical screens.
- **Phase 10:**
  - Full Playwright matrix: every screen × 6 viewports × 2 locales, plus light/dark on the public shell.
  - axe with zero serious or critical issues.
  - Lighthouse CI on home, news and article (mobile): Accessibility / Best Practices / SEO ≥ 95, Performance ≥ 90.
  - Hostinger deployment notes in `docs/frontend/`.

## Definition of done

- Every prototype screen has a working, API-backed counterpart, and every row of plan §6 is ticked off in your final report (screen → route → API calls → test file).
- Build, lint, unit, e2e, axe and Lighthouse targets all pass in CI.
- The site can be fully browsed in Arabic RTL and English LTR at 360px and 1440px with no layout breaks.
- Project docs stay in `docs/`, and the repo root holds only `README.md`, `CLAUDE.md` and config files.

Start by reading the inputs. Then give me a short plan for Phase 0, including the exact Angular 22 scaffold command you'll use. Do it, then stop and report.

In a cloud session: push each phase to a branch named `feat/phase-N` and open a PR against `main`. Don't merge it yourself.
