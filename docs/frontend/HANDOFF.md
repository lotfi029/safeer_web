# safeer_web — handoff

Session 1 (Phases 0–6 plus the W1–W24 fix pass) built the public site, the apply flow, the student portal and the staff invitation/reset pages. **Stage 2** (Phases 7–10, `docs/safeer-web-session-2-combined-plan.md`) builds the admin dashboard and moves the e2e suite onto the real API. Read §0 first, then the rest.

- **PRs:**
  - Phases #1–#8 are merged.
  - The fix pass is lotfi029/safeer_web#9 (`fix/session-1-review`). It was still an open draft when Stage 2 started.
  - Stage 2 branches are **stacked**: `feat/phase-7` on `fix/session-1-review` (what `main` gets once #9 merges), `feat/phase-8` on `feat/phase-7`, and so on.
  - Each phase has a draft PR whose base is the previous phase's branch.
- **Backend:** built and tested against the real `safeer_api` at **`v1.0.0-rc1`** (`SAFEER_API_REF`). Real-API e2e is required, and nothing is mocked by default (CLAUDE.md).
- **Test totals (end of Phase 10, final):**
  - lint clean
  - unit tests: 53 files, 225 tests
  - server + script tests: 113
  - e2e PR matrix (390/1440 × ar/en, + dark at 1440): mock **283/283**, real API **276/276**
  - e2e full matrix (6 viewports × 2 locales × light/dark): mock **483/483**, real API **476/476**
  - 7 tests are `@mock-only` (§0.3)
  - initial bundle: **139.8 KB gzip** (limit 150; `check-gzip-budget.mjs` now follows static imports, §0.6)
  - Lighthouse mobile, median of 5: home 96/100/96/100, news 90/100/100/100, article 97/100/100/100 (Perf/A11y/BP/SEO)

---

## 0. Stage 2 status

### 0.1 Phases

| Phase | Branch (PR base) | Scope | State |
|---|---|---|---|
| 7 | `feat/phase-7` (`fix/session-1-review`) | real-API test support, admin shell, login/forgot, overview, applications list + review, messages | done (#10) |
| 8 | `feat/phase-8` (`feat/phase-7`) | content CRUD kit, pages and news editors, media | done (#11) |
| 9 | `feat/phase-9` (`feat/phase-8`) | users, settings (map fields), mail/SMS, audit, redirects, newsletter, interview slots, account, anonymise | done (#12) |
| 10 | `feat/phase-10` (`feat/phase-9`) | hardening, full matrix, axe, Lighthouse, CSP, deployment docs | done (§0.6) |

### 0.2 Real-API e2e (every spec runs on both backends)

**`e2e/support/real-db.ts`**
- Active only with `E2E_API_URL`.
- Loads mysql2 and argon2 from the API checkout: `SAFEER_API_DIR`, default `../safeer_api` (CI uses `safeer_api`).
- Uses the same DB env as `scripts/real-api.mjs`, via `scripts/api-env.mjs`.
- `seedStaff(role, {status, locked})` returns `{id, name, email, password, role}`:
  - emails end in `@e2e.invalid`; names are `E2E <role> <rand>`
  - datetimes use `UTC_TIMESTAMP(3)`
  - a lock is `locked_until = +1 h`, `lock_count = 1`
- `insertAuthToken(userId, invite|reset)` returns the raw token; the sha256 hex is stored, with a 48 h (invite) or 60 min (reset) expiry.
- Also: `expireLock(userId)`, `staffRow(userId)`, per-file cleanup (`useRealDb(test)`), and a global teardown that sweeps `email LIKE '%@e2e.invalid'` only.
- Drift tests (`real-db.test.ts`) check the argon2 cost and the token hash against `docs/api/src/auth/*`.

**`e2e/support/real-api.ts`** (both backends)
- `staffAccount(role, opts)`: a seeded user on the real API; the mock fixture account or a mock `/__staff` user on the mock.
- `authToken`, `unlockNow`.
- `staffClient` / `setupAdmin`: an API client that carries the CSRF token.
- `applicationIn(status, tag)`: real API = the public apply API plus a seeded admin moving it to `status`; mock = `/__clone` of the seeded fixture.
- `otpFor`: `GET /__dev/otp/:id` on the real API, `123456` on the mock.
- `openInterviewSlots`, `postContact` / `findMessage`, `postNewsletter` / `findSubscriber`.
- `lettersOnly`: the API's person-name rule allows no digits.

**`e2e/support/newsletter-token.ts`** signs confirm/unsubscribe tokens the way the API does (drift-tested against the snapshot's util).

**Test rules**
- **Fast-submit rule.** The API compares *its own* clock with `formRenderedAt`.
  - UI specs call `page.clock.install({ time: Date.now() - 5000 })` before `goto`; API calls post `formRenderedAt = Date.now() - 5000`.
  - Then they assert the stored row through the admin API, because a dropped submit also answers `{ ok: true }`.
- **Login limiter.** 5/min per email still applies under `NODE_ENV=test`. Every login spec seeds its own user; the 429 test makes 6 attempts on one.
- `E2E_INCLUDE_MOCK_ONLY=1` runs the `@mock-only` tests against the real API too, to find ones that could move.

**Admin fixtures**
- The mock builds admin responses from its own state (`mocks/admin.mjs`).
- `scripts/record-admin-shapes.mjs` records the rc1 response *shapes* (never values) into `mocks/fixtures/admin-shapes.json`; `mocks/admin-shapes.test.mjs` fails on drift.
- Re-record after an API bump: `DB_PORT=3307 node --no-warnings scripts/record-admin-shapes.mjs`. It seeds and then removes its own admin.

### 0.3 `@mock-only` (54 before Stage 2 → 13 after Phase 7 → 8 after Phase 8 → 7 after Phase 9)

| Test | Reason |
|---|---|
| contact map embed ×3 | sets the map through `__site` (allowed); through the admin settings API it would change the real site's map under the parallel public-page tests |
| footer socials (W20) | sets socials through `__site` (allowed), same reason |
| proxy ×3 (R3) | `__echo` / `__log` (allowed) |

Phase 9 moved the redirect-table 301 onto the real API (a redirect created through `/admin/redirects` and removed after).

Phase 8 moved the news pagination, the unpublished/preview ×3 and the testimonial quote layout onto the real API (`e2e/support/content.ts`: `ensureNewsPages`, `draftWithPreview` with a real cover and a preview token, `ensurePublishedTestimonial`; everything created is deleted in `afterAll`).

Mocked admin endpoints: **none**.

### 0.4 Backend follow-ups (found in Stage 2; not fixed here)

- **BF-1** `POST /newsletter` answers a bare `{ ok: true }` in rc1, but `CONTRACT-NOTES.md` documents `{ ok: true, pendingConfirmation: true }`. The form now treats any `ok` as "check your email" (it is always double opt-in), and the mock matches rc1.
- **BF-2** Two `POST /applications` at the same moment can deadlock in MySQL ("Deadlock found when trying to get lock", seen in CI with 2 workers): the duplicate-check locking read and the yearly reference counter take locks in different orders, and rc1 answers the loser with a 500 "Database error" instead of retrying the transaction. Suggested fix in the API: retry the create transaction on ER_LOCK_DEADLOCK. The e2e setup (`applicationIn`) retries a 500 meanwhile.
- **BF-3** (docs only) `CONTRACT-NOTES.md` lists 10 reserved post slugs; the API's `RESERVED_POST_SLUGS` has 12 (`categories`, `category` too). The editor uses all 12.
- **BF-4** `main.ts` calls `app.listen(PORT)` with no host, so the API listens on every interface. The deployment needs it on loopback only: it trusts one proxy hop and rate-limits by `X-Forwarded-For`, which a client could spoof if it reached the API directly. Suggested fix: a `HOST` env variable defaulting to `127.0.0.1`. Until then, `docs/frontend/deployment.md` §1 says to firewall the port or keep the API off any public domain.
- **BF-5** (docs only) `UNSUPPORTED_PROVIDER` is listed as an error code but rc1 never throws it: `provider` is a DTO enum, so a wrong value is a plain 400 `VALIDATION_FAILED`. The UI keeps a message for it anyway.

### 0.5 Admin area (as built)

**Routes** (`features/admin/admin.routes.ts`)
- Signed-out pages (login, forgot, accept/reset) sit beside the shell.
- Every dashboard page is a shell child with `roleGuard` + `data.area`.
- `adminStringsGuard` lazy-loads `core/i18n/translations/admin/{ar,en}.ts` and merges them under `admin.*`, so the public locale chunk never carries them.

**Shell** (`layout/admin-shell.ts`)
- Full sidebar at xl+; an icon rail at lg (names as `title` plus sr-only text); a drawer below lg.
- Menu from `AdminNav`: `ADMIN_NAV` filtered by `StaffSessionStore.can(area)`.
- Badges from `AdminBadges` (`GET /admin/overview`).
- Page titles use `AdminPageHead`.

**API** (`core/api/admin/admin-api.ts` + `admin-models.ts`, shapes from the snapshot)
- `documentUrl(doc)` is the only way to link a document file. A null `downloadPath` means no link.

**Transitions** (`features/admin/applications/transitions.ts`)
- Drift-tested against the snapshot in `transitions.node.test.ts`, which runs under `test:server`.

**Login**
- One message for every 401: a wrong password, a disabled account and a locked account look the same, because the API doesn't tell them apart.
- A separate message for 429.
- Account state appears on the Phase 9 users screen instead.

**Shared components**
- `shared/confirm-dialog.ts` (`confirmAction`)
- `applications/application-dialogs.ts`

**Content area (Phase 8)**
- **CRUD kit** (`features/admin/content/crud/`): `collections.ts` declares each collection (endpoint, area, publish mode `route`/`field`/`status`, sortable, searchable, tabs, fields, row title/subtitle/thumb, child collection, per-row link). `CrudPage` (route data `collections`, `title`, `note`) → `CrudList` (ordered list, CDK drag + move up/down buttons → `POST reorder` with the whole list renumbered, publish switch, edit/delete) → `CrudForm` dialog → `CrudFields` (bilingual pairs, Markdown, selects incl. from another collection, media, checkboxes). Helpers `toBody`/`validate`/`modelFromRow` mirror the DTOs.
- Configured: work areas (+ items with their own visibility, nested), board (group tabs), testimonials (status tabs, publish/hide) + themes, partners (category tabs), documents + sections, stats, about items (kind tabs), news categories; pages use the kit for the list and the sections (`/admin/pages/:id`).
- **News** is hand-built: `news/news-list.ts` (filters all/published/draft/legacy in the URL, search, legacy banner + `DELETE admin/news/legacy`) and `news/news-editor.ts` (Markdown with preview, cover, slug with the API's rules incl. the 12 reserved words, `SLUG_TAKEN` on the field, `COVER_MISSING` as a notice, preview through `GET admin/preview-token` → `/news/<slug>?preview=`).
- **Markdown**: `marked` (same library and config as the API), rendered to the API's tag allow-list (`markdown/render-markdown.ts`), then Angular's sanitizer. Toolbar inserts only syntax the API keeps.
- **Media**: `media/media-store.ts` (the library cached; rows only carry asset ids), `media-uploader.ts` (type/size checks like the API; images ask for Arabic alt text at once because the API refuses to attach an image without it, ALT_TEXT_REQUIRED), `media-picker.ts`, `media-library.ts` (`ASSET_IN_USE` lists the usages). URLs: `mediaUrl()` → `/files/:publicId[/thumb|card|full]`.
- API rules worth knowing: the kernel's column filters compare as strings (send booleans as `1`/`0`); a bad FK id is a 500, so selects only offer existing rows; admin responses are never collapsed (raw `xAr`/`xEn`).
- Mock: `mocks/admin-content.mjs` (the kernel for every collection + news/testimonials/pages/media specifics), seeded from rows recorded from the API (`mocks/fixtures/adminContent.json`, `record-admin-shapes.mjs --content`, e2e rows filtered out). Admin content state is separate from the public fixtures.

**System area (Phase 9)**
- `core/api/admin/system-api.ts`: users, invite, settings, cache, mail/SMS (settings, templates, preview, test, log, retry), audit, newsletter (+ CSV), account (password, sessions), anonymise.
- **Users** (`system/users.ts`): status active/disabled/invited + the brute-force lock (unlock), invite (48 h link), edit (own role locked; the API guards the last active admin: `LAST_ADMIN`), delete (not yourself), and the role matrix from `GET /admin/roles`. There is no "resend invite" in the API.
- **Settings** (`system/settings.ts`): the whole `PUT admin/settings` DTO in sections (a partial is sent: only changed fields); `mapEmbedAllowed()` mirrors `MAP_EMBED_ALLOW_LIST`; plus cache stats/purge.
- **Mail/SMS** (`system/channel.ts`, route data `channel`): settings (the password/token is write-only: empty keeps it), test send (`{ ok, error }` is shown, not thrown), templates (variables listed; unknown `{{ x }}` refused client-side and on `UNKNOWN_VARIABLE`; server preview), log with status/template filters in the URL (mail rows with `hasPayload` can be retried; SMS logs never carry the message).
- **Audit** (`system/audit.ts`): entity/actor filters (the API's only two), changed-field diff per row.
- **Redirects** and **interview slots** use the CRUD kit (`deleteArea: 'redirects.delete'`, `errorField` puts `REDIRECT_CHAIN` on fromPath or toPath; slots use the `datetime` field type = Riyadh wall-clock ↔ `+03:00` ISO, and `after`).
- **Account** (`/admin/account`, the user chip): change password (401 = wrong current password; ends other sessions), sessions list and sign-out.
- **Anonymise**: the review screen's danger card (`applications.delete`).
- Mock: `mocks/admin-system.mjs` (seeded from `fixtures/adminSystem.json`, recorded); interview slots and redirects share state with the portal booking and `redirects/resolve`.

**Tokens**
- `--sidebar-*`: the sidebar is dark in both themes.
- `text-secondary-text`: for secondary-coloured text on `app-bg`, where plain `--secondary` is only 4.41:1.

### 0.6 Phase 10: hardening (as built)

- **Motion:** dialogs rise and fade in, the side drawer slides from the inline end (direction-aware), the bottom sheet from below, toasts from the inline end, and the scrim fades (`src/styles/motion.css`). All of it is enter-only, and none of it runs under `prefers-reduced-motion`.
- **Dark theme in every screen check:** `checkScreen()` flips `data-theme` after the light check, then runs the scroll check, axe and a `-dark` screenshot again (`checksDark`: every viewport in the full matrix, 1440 per PR). It found one real bug: the admin sidebar title used `--on-primary`, which is dark in dark mode (1.12:1). It now uses `--sidebar-text`.
- **Full matrix fixes:** the first full-matrix run (every viewport) found horizontal page scroll in two places the PR matrix (390/1440) can't see:
  - The applications table at 768–1024: the table's `sr-only` labels are absolutely positioned, and their containing block was outside the table's scroll box, so they widened the page. The data-table scroll container is now `relative`, the same fix as the Phase 9 users matrix.
  - The overview chart's data table at 360: `sr-only` doesn't shrink a `<table>`, so `sr-only` now sits on a wrapper `<div>`.
  - **Rule:** put `sr-only` on a block, never on a table, and make any `overflow-x-auto` box that contains `sr-only` text `relative`.
- **CSP on every route type** (`security.spec.ts`):
  - nonce, headers and zero violations for home (ar and en), a CMS page, news list, article, contact, apply, admin and portal entry
  - the 404 page
  - signed-in admin screens: overview, applications, news editor, media, settings, mail templates
  - `frame-src`: iframes to the two map hosts load with no violation; any other host is blocked
- **Lighthouse (mobile):** `npm run lighthouse` (`scripts/lighthouse.mjs`) audits the production build over the mock API. Playwright's Chromium is attached over CDP, because `lhci`/chrome-launcher crashes on Windows on its temp-profile cleanup (EPERM). It takes the median of `LH_RUNS` (CI: 7) and writes reports to `.lighthouseci/`. Getting to target took four changes:
  1. **Compression** (`compression`, br/gzip) for everything the SSR server produces itself, mounted after the proxy. Until then HTML and JS went out raw.
  2. **The @font-face sheet is inlined**, with the nonce, into every HTML response (`inlineStylesheet` in `src/server/html.ts`) instead of a render-blocking `<link>`.
  3. **`index.preloadInitial: false`** (angular.json): no `modulepreload` for the initial chunks. SSR paints without JS, and the preloads competed with the document for bandwidth before first paint.
  4. **Smaller preloads:** only the body-text face (400) is preloaded, which is the LCP text. The logo was a 74×112 PNG copy then; it is now the official vector mark (`public/brand/safeer-mark.svg`).
- **`app.cjs`:** a CommonJS start file for Hostinger's `lsnode.js`, which `require()`s the entry. It sets `SAFEER_SSR_LISTEN=1`, which `server.ts` checks, and imports the ESM bundle. Verified locally with `require('./app.cjs')`: `/healthz` = 200.
- **Gzip budget script:** with `preloadInitial` off, the CSR index no longer lists the initial chunks, so `check-gzip-budget.mjs` follows the static imports of the entry scripts instead. It reports 139.8 KB, the same set as before.
- **CI:** `ci.yml` now also runs nightly (the full matrix on **both** backends) and has a `lighthouse` job. `nightly.yml` (mock only) is gone.
- **Deployment runbook:** `docs/frontend/deployment.md` (topology, env and the values that must match the API's, `app.cjs` vs PM2, deploy order, rollback, verification, backups, monitoring, client-owed items).

---

## 1. As-built architecture

**Stack**
- Angular 22.2: standalone, zoneless, OnPush everywhere, signal inputs.
- SSR through `@angular/ssr` with an Express 5 `server.ts`.
- Tailwind 4 and the Angular CDK (dialog, overlay, a11y, bidi).
- Transloco with bundled dictionaries.
- Signal Forms (`[formField]`).
- Vitest for unit and server tests, Playwright + axe for e2e.

**Rendering modes** (`src/app/app.routes.server.ts`)
- The public site is `RenderMode.Server`.
- `:lang/admin/**` and `:lang/portal/**` are `RenderMode.Client`. The server sends the CSR shell with `no-store` and `X-Robots-Tag: noindex, nofollow`.

**Request path in production**

```
browser → Express (src/server.ts)
  /healthz
  → security headers (per-response CSP nonce)
  → /ar|/en redirects + trailing-slash 301
  → robots.txt, sitemap.xml (10-min cache)
  → legacy WordPress lookup (301 via redirects/resolve, or 410)
  → /api/** and /files/** proxy to API_INTERNAL_URL (XFF overwritten)
  → static assets (hashed = 1 year immutable; never .html)
  → Angular SSR (`__CSP_NONCE__` replaced in every HTML response)
```

The server modules live in `src/server/*.ts`, each with a `.test.ts`. Deployment notes are in `docs/frontend/deployment.md`.

**Data loading**
- Each page's critical data is fetched by a route resolver: `loadCritical()` in `core/data/loaded.ts`.
- On failure the page renders its error panel with the right SSR status (review F8):
  - 404 for `NOT_FOUND`
  - 503 + `Retry-After: 30` when the API is unreachable
  - 500 otherwise
- Secondary data uses `loadSecondary()` and degrades to an empty value.
- Resolvers bind to the component's `data` input through `withComponentInputBinding`.
- **Resolvers live in `<page>.resolver(s).ts`, never in the component file.** `public.routes.ts` imports them statically, so importing from a component pulled the whole page into `main` and broke the budget in Phase 3.

### Deviations from the plan (and why)

| Plan | As built | Reason |
|---|---|---|
| `httpResource` or services + `toSignal` for page data | Route resolvers + `Loaded<T>` | One place to set the SSR status (404/503/500) before render, and the data arrives as a plain input. |
| F11: `openapi-typescript` → committed `core/api/generated.ts` | **Not done.** Request and response types are hand-written in `core/api/models.ts`, checked against `docs/api/openapi.json` and the mappers in `docs/api/src`. | Time went into the screens. Session 2 can add `npm run api:types` (`npx -y openapi-typescript@7 docs/api/openapi.json -o src/app/core/api/generated.ts`) and swap the request types over. |
| Per-endpoint `LIVE_ENDPOINTS` mock toggle | **Not needed.** Every endpoint is live in rc1. Mocks are all-or-nothing: `environment.useMocks` for `ng serve`, and the Node mock API for e2e. CI runs the same e2e suite against the real API too (`e2e-real`, W24). | The mock stays for fast, deterministic runs and for states the dev seed lacks. |
| `src/app/core/api/contract-assumptions.md` | Not created. The assumptions are listed in §6 below. | `docs/api/CONTRACT-NOTES.md` covered almost everything. |
| Apply form "hydrates on interaction" | Normal hydration at bootstrap | Deferred hydration resets values typed before it runs. |
| Newsletter band `hydrate on viewport` | Plain `@defer (on viewport)`, rendered in the browser only | Same reason. It's below the fold and not needed for SEO. |
| Contact map facade loads an iframe on click | Done (A12): a "show the map" button loads `settings.mapEmbedUrl` in an iframe, only when it is a Google Maps embed or OpenStreetMap URL (`shared/map/map-embed.ts`). "Open in maps" uses `mapLat`/`mapLng`, or the address. | `frame-src` allows exactly those two origins. Nothing third-party loads until the visitor clicks. |
| Scholarship steps as `app-timeline` | Custom rail (vertical below xl, 5-column row at xl) | `app-timeline` models done/now/pending states, which don't fit static numbered steps. |
| Prototype: `scholarshipNote` in apply step 3 | Step 2 | Follows the plan. |
| Prototype: single OTP text input | 6-box `app-otp-input` | Follows the brief. |
| Eyebrow colour `--secondary` | New token `--secondary-text: #197679` | `#1c8184` on `--surface` is 4.41:1, below AA. The new token is 5.1:1. |
| Header nav labels from `GET /site` | Short labels keyed by slug (`NAV_SHORT_LABELS` in `core/site/nav-routes.ts`, the prototype's `NAV`), falling back to the API title; the drawer keeps the API titles (W5) | The API nav carries full page titles ("Scholarships for international students in Saudi universities"), which overflowed the header at 1440 in English. |
| Home section `label` as eyebrow | Only for the keys in `EYEBROW_SECTION_KEYS` (`home.ts`); never the hero or CTA (W6) | `label` is the section's name in the CMS ("Hero"), not public copy. |
| Fonts in the global stylesheet | `@font-face` in the static `public/fonts/fonts.css` (`data-beasties-skip`), plus 2 per-language preloads from `core/i18n/font-preloads.ts` (W13) | The critical-CSS inliner preloaded all 14 faces on every page. |

---

## 2. UI kit inventory

Everything is in `src/app/shared/ui/`. Each component is standalone and OnPush, works in RTL/LTR and light/dark, and is demoed at `/:lang/_kit` (dev and e2e builds only). The Anchor column is the section id on that page.

| Component | Selector | Key inputs / outputs | Anchor |
|---|---|---|---|
| Button | `button[appButton]`, `a[appButton]` | `variant` (primary, ghost, soft, line, danger, onband, onband-ghost, link), `size` (md 52px / sm 44px), `block`, `busy` | `#kit-buttons` |
| Icon button | `button[appIconButton]` | `appIconButton` = accessible label (required) | `#kit-buttons` |
| Icon | `app-icon` | `name` (from the Lucide sprite `public/icons.svg`; list in `icon-names.ts`, rebuilt by `scripts/build-icons.mjs`), `size`, `label`, `directional` (arrows mirror in RTL, so **use `arrow-right` for "forward"**) | `#kit-icons` |
| Card / feature card | `app-card`, `app-feature-card` | `hover`, `flush`, `tone` / `icon`, `heading`, `body`, `level` | `#kit-cards`, `#kit-feature-cards` |
| Field + control | `app-field`, `input\|select\|textarea[appControl]` | `label`, `hint`, `state` (a Signal Forms field state), `errors` (extra errors, e.g. from the server), `optional`, `forceErrors` | `#kit-fields` |
| Choice group | `app-choice-group` | `legend`, `hint`, `error`, `required`, `columns`; wraps `label.choice` radios or checkboxes | `#kit-choices` |
| OTP input | `app-otp-input` | Signal Forms `FormValueControl<string>`; `length`, `labelledBy`, `describedBy`; `(completed)` | `#kit-otp` |
| File drop | `app-file-drop` | `accept`, `maxBytes` (defaults: PDF/JPG/PNG, 5 MB), `multiple`, `label`, `status` (idle, uploading, done, error), `progress`, `error`; `(filesSelected)`, `(rejected)` | `#kit-file-drop` |
| Stepper | `app-stepper` | `steps`, `current`, `completed`; compact "step x of y" below md | `#kit-stepper` |
| Timeline | `app-timeline` | `items` ({key, label, state, caption}), `orientation` (auto, vertical, horizontal) | `#kit-timeline` |
| Pills | `app-pill`, `app-status-pill`, `app-doc-status-pill` | `variant` / `status` (the 7 application statuses; document statuses plus `missing`) | `#kit-pills` |
| Progress | `app-progress` | `value`, `label` (required), `showValue`; restyled automatically inside `.band` | `#kit-progress` |
| Note | `app-note` | `kind` (info, warn, ok), `icon`, `live` | `#kit-notes` |
| Skeleton | `app-skeleton` | `width`, `height`, `lines`, `rounded` | `#kit-skeleton` |
| Empty state | `app-empty-state` | `icon`, `title`, `body`, plus projected actions | `#kit-empty` |
| Tabs | `app-tabs`, `app-tab`, `ng-template[appTabContent]` | CDK-based; `selectedIndex` | `#kit-tabs` |
| Accordion | `app-accordion`, `app-accordion-item` | `heading`, `open`, `name` (native `<details>`) | `#kit-accordion` |
| Dialog | `DialogService.open(cmp \| tpl, {ariaLabelledBy})`, `app-dialog-frame` | `heading`, `headingId`, `closable`, `(dismissed)`, plus `[dialogActions]` slot | `#kit-dialog` |
| Drawer | `DrawerService`, `app-drawer-frame` | inline-end sheet with focus trap; `heading`, `closeLabel` | `#kit-drawer` |
| Toast | `ToastService.success/info/error()`, `app-toast-outlet` | aria-live polite, or assertive for errors | `#kit-toast` |
| Filter bar | `app-filter-bar` | `chips`, `selected`, `searchValue`, `linkMode` + `queryParamName` (crawlable links), `debounceMs`; `(searchChange)`. Below 480px the chips move into a bottom sheet. | `#kit-filter-bar` |
| Pagination | `app-pagination` | `page`, `total`, `pageSize`, `queryParamName`; real `<a>` links that merge query params | `#kit-pagination` |
| Data table | `app-data-table` + `ng-template[appDataTableCell="key"]`, `[appDataTableActions]`, `[appDataTableEmpty]` | `columns`, `rows`, `trackBy`, `caption`, `loading`, `error`, `selectable` + `[(selection)]`, `[(sort)]`. Semantic `<table>` at md+, card list below md. | `#kit-data-table` |
| Page head / breadcrumb | `app-page-head`, `app-breadcrumb` | `title`, `lead`, `breadcrumb` ({label, link?}) | `#kit-page-head` |
| Section heading | `app-section-heading` | `eyebrow`, `heading`, `lead`, `level`, `align`, `headingId` | `#kit-section-heading` |
| Image | `app-image` | `asset` (`/files/{publicId}/{thumb\|card\|full}` srcset, F12), `placeholder` (labelled `[صورة: …]` slot when there is no asset), `sizes`, `priority`, `aspect`, `imgClass` | `#kit-images` |
| Rich text | `app-rich-text` | `html`: **the only `innerHTML` in the app**. API-sanitized HTML is sanitized again with `DomSanitizer`. | n/a |
| Counter | `app-counter` | `value`, `duration`; SSR renders the final value | `#kit-counters` |
| Reveal | `[appReveal]` | `revealIndex`; hidden state is added only in the browser, and never under reduced motion | `#kit-reveal` |
| Flowing lines / arc divider | `app-flowing-lines`, `app-arc-divider` | `tone`, sizes | `#kit-lines` |
| Logo / brand | `app-logo`, `app-brand` | `height`, `name`, `tagline`, `compact` | `#kit-logo` |

**Pipes** (`shared/pipes/format.ts`, demoed at `#kit-pipes`)
- `digits` (Arabic-Indic digits in `ar`)
- `fileSize`
- `localDate` (Gregorian calendar with Arabic digits: `ar-SA-u-ca-gregory-nu-arab`)
- `relTime`
- Plain helper: `toArabicDigits()`

**Forms helper:** `problemToTreeErrors()` in `shared/forms/server-errors.ts`.

---

## 3. API layer

**Services** (`src/app/core/api/`), all returning `Observable`s:

| Service | Covers |
|---|---|
| `PublicApi` | site, home, pages, about-items, board (`{board, executive}`, W1), work-areas, news, testimonials, partners, documents, countries, contact, newsletter + confirm/unsubscribe (`{email, token}`, W3). `sitemap.xml` reads `sitemap-index` server-side (`src/server/sitemap.ts`), not through `PublicApi`. |
| `PortalApi` | applications, portal me/patch/submit, **`correct()` (`PATCH /portal/application/corrections`, C15, `docs_missing` only)**, documents (upload with `reportProgress`; one current document per type, W4), notifications (paged `{data,total,page,limit}`, W2), interview slots/book/cancel, OTP auth |
| `StaffApi` | admin auth (login, logout, **`acceptInvite`, `resetPassword`**, W16), `/admin/me`, `/admin/roles`. **Session 2 adds the admin feature APIs here or in sibling services.** |

- **Models:** `models.ts` holds collapsed, locale-resolved shapes. B19: documents type only the public fields.
- **Errors:** `problem.ts` defines `ApiProblem` ({status, code, fieldErrors from zod `issues[].path[0]`, extra}), `toApiProblem()`, and `problemMessageKey()` (maps to `errors.codes.*`).

**Interceptors** (`core/http/`), in order:

| Interceptor | What it does |
|---|---|
| `locale` | `?lang=` + `Accept-Language` |
| `credentials` | Sends cookies on `/admin`, `/portal` and `POST /applications` |
| `csrf` | Adds `X-CSRF-Token` from `CsrfTokens` on non-GET requests |
| `problemDetails` | Normalises errors to `ApiError`. A 401 in an area triggers `SessionExpiry`, except for auth probes. |
| mock (dev only) | Answers from the in-app mock backend |
| `serverForward` (SSR only) | XFF + Accept-Language from the request, 5 s timeout |

**Server-side API base (W9).** Requests stay relative (`/api/v1/…`) through every interceptor. On the server, `InternalApiBackend` (`core/http/internal-api.backend.ts`, provided as `HttpBackend` in `app.config.server.ts`) rewrites them to `API_INTERNAL_URL` *below* Angular's HTTP transfer cache. So the server and the browser key the cache on the same URL: the browser reuses the SSR responses (no `/api/v1` request after hydration), and the internal origin never reaches the page. Don't reintroduce a URL-rewriting interceptor; `e2e/specs/transfer-cache.spec.ts` guards this.

The HTTP transfer cache carries only anonymous public GETs.

**Stores and guards** (`core/auth/`)

- `StaffSessionStore`
  - `me` and `csrfToken`, loaded from `/admin/me`.
  - Guards: `staffGuard`, `staffLoginGuard`.
  - `roleGuard` reads `data.area` and checks `GET /admin/roles` (B17). The area keys are the API's real ones (W15): `applications, content, inbox, users, settings, audit` and the `*.delete` variants. `role-matrix.ts` is the typed fallback.
- `ApplicantSessionStore`
  - `me` and `canWrite`.
  - `startSession(csrf)` is called after `POST /applications` and after `verify-otp`.
  - `refresh()` re-reads `/portal/me`; its `csrfToken` (B16) keeps writes working after a reload. **Only a 401 ends the session (W11):** a 502, timeout or network error keeps a signed-in student signed in, and leaves an unknown session unknown so it's retried.
  - `onClear()` fires on logout, 401 and `clear()`. The store itself removes the apply form's offline draft then (W10; the key is in `core/auth/apply-draft-key.ts`).
  - Guards: `applicantGuard`, `applicantLoginGuard`.

**Adding an endpoint and its mock**

1. Add the method to the right service. For a new response shape, add the type to `models.ts`.
2. Add a route in `mocks/backend.mjs` as `[METHOD, /^\/api\/v1\/…$/, ({lang, query, params, body, req}) => json(…) | problem(…)]`.
3. For fixture data, create `mocks/fixtures/<name>.json` and list it in `mocks/fixtures.mjs`.
   - Bilingual fields use the `xAr`/`xEn` pair, which `collapseBilingual` resolves per language.
   - **Public fixtures are recorded from the API, never hand-shaped:** add the endpoint to `RECORDABLE` in `scripts/record-fixtures.mjs` and run `node scripts/record-fixtures.mjs --only <name>` against a running API. It fetches `ar` and `en` and merges them into the `xAr`/`xEn` form. The hand-written mock nav labels are what hid W5.
   - Hand-written fixtures (`posts`, `testimonials`, staff/portal state): **only spec content or `[…]` placeholders. Never invent content.**
4. The same backend serves both `ng serve` (in-app interceptor) and the e2e mock API (`e2e/mock-api/server.mjs`, port 3100), so one change covers both.
5. Add an e2e test that runs against **both** APIs unless it truly can't (then tag it, §5).

The e2e mock has these test-only routes:
- `/api/v1/__echo`
- `GET` / `DELETE /__log` (shared by parallel workers: find your own entries, e.g. by client IP; don't clear it)
- `POST /__site` merges into the site settings (send nulls to restore)
- `POST /__auth-token` `{purpose: accept|reset}` mints a single-use staff link token (W16)
- `POST /__reset`, with `?reference=SA-…` to restore a single seeded application
- `POST /__clone?reference=SA-…&tag=…`: a fresh copy of a seeded application (Stage 2)
- `POST /__staff` `{role, status?, locked?}`: a staff user with a known password; `POST /__staff/:id/expire-lock` (Stage 2, the mock twin of `real-db.ts`)

---

## 4. Conventions

**Folders**

| Folder | Holds |
|---|---|
| `core/` | services, stores, i18n, SEO, theme, platform helpers |
| `shared/ui/` | the UI kit |
| `shared/pipes/` | formatting pipes |
| `shared/forms/` | form helpers |
| `layout/` | shells |
| `features/<area>/` | pages; public pages in `features/public/<page>/` |

- One component per file, named after the selector without `app-`.
- Resolvers go in `*.resolver(s).ts`.

**i18n**
- Transloco dictionaries in `core/i18n/translations/ar.ts` (source of truth) and `en.ts` (typed as `Translation`).
- Key scheme `area.screen.key`.
- Large page dictionaries live in `translations/pages/<page>.ts` (`export const ar = {…}; export const en: typeof ar`) and mount at `pages.<page>`. The portal mounts at `portal`.
- Admin strings: the small signed-out set (`admin.login`, `admin.setPassword`, `admin.forbidden`) is in the base dictionaries; everything else is in `translations/admin/{ar,en}.ts`, lazy-loaded by `adminStringsGuard` and merged under `admin.*` (§0.5).
- `LocaleService`:
  - `lang()`, `dir()`, `intlLocale()`
  - `link(path)` builds a `/:lang` path
  - The language guard sets `<html lang dir>` on the server and the client.
- Phone numbers, emails and references go in `<bdi dir="ltr">`.

**Signal Forms patterns**
- `form(signal(model), schema)` with the built-in validators.
- Templates use `[formField]`.
- `<app-field [state]="f.x()" [forceErrors]="tried()">` shows errors after a submit attempt.
- Server errors:
  - Inside `submit()`, return `problemToTreeErrors(form, problem)`.
  - For multi-step forms where `submit()` validates too much, pass `[errors]` to `app-field`. See `srv()` in `features/apply/apply.ts`.
- **Autosave** (`features/apply/apply-payload.ts`)
  - Diff with `changedFields(synced, value)` and send only fields that are currently valid.
  - `toPatch()` sends `null` only for the four nullable fields (F4) and omits other empty values.
- **Offline draft** (`apply-draft.ts`): sessionStorage, 24 h TTL, never stores ID number or birth date (F5), tied to its application `reference` and cleared by `ApplicantSessionStore` on logout/401 (W10).
- **Validation that mirrors the API** (`core/validation/`, W14): `isPersonName()` is the API's C16 name rule, and `normalizePhone()` is its B2 phone rule, including Arabic-Indic and Persian digits. Use these, never a local regex, so the client rejects exactly what the API would. Keep them in sync with `safeer_api` `src/common/validation/person-name.ts` and `src/common/phone.ts`.
- **API HTML in text-only slots:** `plainText()` (`shared/text/plain-text.ts`) strips tags and decodes entities; use it for card and section leads.
- Anti-spam forms (contact, newsletter):
  - Hidden honeypot `website` inside an `aria-hidden` sr-only wrapper.
  - `formRenderedAt` set in `afterNextRender`.

**SEO**
- `pageSeo()` in `features/public/page-meta.ts` for CMS pages, or `SeoService.set()` directly. It covers title, description, canonical, hreflang ar/en/x-default, OG/Twitter, robots and JSON-LD.
- Private pages call `SeoService.noindex()`.
- JSON-LD in use: NGO (home), NewsArticle + BreadcrumbList (article).

**Motion**
- `motion.css` durations are all zeroed under `prefers-reduced-motion`.
- `motionAllowed()` in `shared/ui/reveal/motion.ts`.
- Route view transitions are skipped on the first load.

**RTL and design tokens**
- Logical properties and utilities only (`ms-`, `pe-`, `start-`, `text-end` …).
- Hex colours only in `src/styles/tokens.css`.
- Both rules are enforced by `scripts/lint-styles.mjs` (in `npm run lint`).
- Breakpoints: `sm` 480, `md` 768, `lg` 1024, `nav` 1100 (header burger only, F7), `xl` 1280.
- Touch targets are at least 44 px.
- Muted text on the dark `.band` fails contrast. Use the `band-*` tokens there.

**Hydration gotcha**
- A value typed into a server-rendered field *before* hydration can be reset when the component hydrates. Event replay replays clicks, not input.
- Keep critical forms eagerly hydrated. Render below-the-fold forms client-side (`@defer (on viewport)` with no `hydrate`).
- `App` sets `<html data-hydrated>` after the first client render. In e2e, use `gotoHydrated()` / `waitForHydration()` (`e2e/support/hydration.ts`; `openAt` already waits) before typing. `networkidle` alone made an apply spec flaky under load.

**Lint**
- `npm run lint` runs ng lint (angular-eslint with template a11y rules as errors and OnPush required), lint-styles and prettier (with the Tailwind plugin).

---

## 5. Test tooling

- **Unit:** `npm run test:ci`. Vitest on jsdom via `ng test`, specs are `src/**/*.spec.ts`.
- **Server and scripts:** `npm run test:server`. Vitest on node (`vitest.server.config.mts`), specs are `src/server/*.test.ts`, `scripts/*.test.mjs`, `mocks/*.test.mjs`, `e2e/support/*.test.ts` and `src/app/**/*.node.test.ts` (drift tests against `docs/api`).
- **e2e:** `npx playwright test` (set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` in this container).
  - `webServer` starts the mock API (3100), the SSR build from `dist/safeer_web-e2e` (4100), and a second SSR server pointed at a dead API (4101).
  - Build first with `npm run build:e2e`: production optimisations, CSP enforced, `/_kit` included.
  - `E2E_API_URL` switches to a real API (the mock server isn't started).
- **Against the real API (W24):** CI job `e2e-real` in `ci.yml` checks out `lotfi029/safeer_api` at `vars.SAFEER_API_REF` (default `v1.0.0-rc1`), runs MySQL 8, and boots the API through `scripts/real-api.mjs`, which is the same script you use locally (README "Run e2e against the real API locally", 3 commands). The API runs with `NODE_ENV=test`: its own switch for skipping the per-IP `@Throttle` buckets, which a parallel suite from one IP would exhaust; otherwise it behaves like `development` (dev seed, dev OTP hook). Rate limiting stays tested in the API; the site's 429 handling in the mock.
- **`@mock-only`:** `mockOnly(reason)` from `e2e/support/env.ts` tags a test or describe block; `playwright.config.ts` drops the tag when `E2E_API_URL` is set, and the reason shows as an annotation. List them with `npx playwright test --list --grep @mock-only`. Tag only what truly can't run against the real API (mock routes, mock accounts/tokens, fixture content the dev seed lacks), and prefer contract-bound assertions (compare with the API response) over fixture-bound ones.
- **Applicants against the real API:** the API refuses a second active application for the same email **or** phone (409), so every spec creates its applicant with `newApplicant()` (random email and phone) in `apply.spec.ts`.
- **Matrix helper** (`e2e/support/matrix.ts`)
  - `matrix()` gives 390 and 1440 × ar/en per PR. With `E2E_FULL_MATRIX=1` it covers 360/390/768/1024/1440/1920 × ar/en, which runs nightly and on the `full-matrix` label, on both backends.
  - `openAt(page, path, viewport, locale, theme?)` opens the page with reduced motion.
  - `checkScreen(page, testInfo, name, viewport, locale)` checks for no horizontal scroll, runs axe (serious or critical fails), and takes a screenshot, then does the same in dark mode (`checksDark`: every viewport in the full matrix, 1440 per PR).
- **Screenshots**
  - Viewport-only, palette-compressed to ≤150 KB, attached to every test.
  - With `E2E_SCREENS_DIR=docs/frontend/screens/phase-N`, the 390 and 1440 shots are written as `{screen}-{ar,en}-{390,1440}.png`.
- **Fixtures**
  - `mocks/fixtures/*.json`, one source for dev and e2e (F6).
  - Mock credentials: OTP `123456`; staff `admin|reviewer|editor|support@mock.invalid` with password `mock-password`.
  - Seeded applications `SA-2026-00101…00107`, one per status.
  - Tokens: newsletter `mock-token`, article preview `mock-preview`, staff links `mock-invite` (`/:lang/admin/accept/mock-invite`) and `mock-reset`, single-use per mock process.
  - Public fixtures are recorded from the API (`scripts/record-fixtures.mjs`, §3).
  - Specs that change an application get their own copy (`applicationIn()`: mock `/__clone`, real API a new application), so no two specs share one.
- **Prod artifact:** `scripts/check-prod-artifact.mjs` fails if the production build contains the mock registry or the `/_kit` route.

---

## 6. Status

### Backend items (`docs/safeer-backend-fix-prompt.md`)

All of them are **live in `safeer_api` v1.0.0-rc1** and covered by the `e2e-real` job, except where a row says the test is mock-only.

| Item | Status in this frontend |
|---|---|
| B1 OTP channel choice | Built; `channel` sent to `request-otp`. e2e on both backends (real: OTP from `GET /__dev/otp/:id`). |
| B2 phone identifier + `APPLICATION_EXISTS` | Built; 409 on the same email **or** phone, e2e against both APIs |
| B3 re-upload rules | Enforced in the UI (`canUpload`) and the mock |
| B9 clean `/x` button URLs | Used as is; a legacy `#/x` mapper stays in `core/site/nav-routes.ts` |
| B12 board bio | Rendered when present |
| B15 `GET /sitemap-index` | Read server-side by `sitemap.xml` |
| B16 `csrfToken` on `/portal/me` | Writes keep working after a reload |
| B17 `GET /admin/roles` | Real area keys (W15), typed fallback in `core/auth/role-matrix.ts` |
| B18 `GET /about-items?kind=` | About, Scholarships, home |
| B19 public document fields only | Types ignore `storageKey`/`checksum` |
| C2 frontend routes | `/:lang/portal/login`, `/:lang/admin/login`, **`/:lang/admin/accept/:token`, `/:lang/admin/reset/:token` (W16)** |
| C15 corrections | `PortalApi.correct()` → `PATCH /portal/application/corrections`, `docs_missing` only |
| C17 interview in `/portal/me` + `DELETE /portal/interview` | Built; e2e on both backends (slots created through `/admin/interview-slots`) |
| C26 sanitized HTML for section/about bodies | Rendered through `app-rich-text` (re-sanitized); `plainText()` for text-only slots |
| C27 newsletter double opt-in, confirm/unsubscribe | `{email, token}` from the mailed link (W3) |
| C35 notifications | Paged `{data,total,page,limit}` with the API's event set (W2) |
| A1–A12 (`API-CHANGES.md`) | Adopted in `cf40539` |

**Contract source:** `docs/api/` is the rc1 snapshot (W23). Refresh it with `node scripts/snapshot-api.mjs ../safeer_api <ref>` whenever `SAFEER_API_REF` moves, then re-record the fixtures.

### Known issues / TODOs
- **Accordion headings:** `app-accordion-item` puts its heading inside `<summary>`, so work-area titles on mobile aren't headings in the accessibility tree.
- **Filter-bar chips on phones:** in `linkMode` the chips move into a bottom sheet below 480px. The partners page uses plain chip links instead. News keeps the sheet; revisit if SEO reviewers want the links visible.
- **SSR forms and hydration:** see the hydration gotcha in §4.
- **Admin area:** see §0.5.
- **Lighthouse:** see §0.6. The performance score depends on the machine: on the dev machine the median of 5 runs still ranged 85–97 per page across passes of the same build, so CI takes the median of 7 (`LH_RUNS=7`).
- **Types:** F11 generated types are not done (see §1).
- **Dev-seed images:** the API's dev seed stores flat-colour JPEGs for its sample assets (hero, news covers), so those render as plain grey-teal boxes. They are real images with their alt, not missing placeholders (W7); sections with no asset show the labelled `[صورة: …]` placeholder.
- **Portal help card:** links to the contact page because the portal shell doesn't load `/site`.

### Still needed from the client
- **Logo:** received. The official SVG is `docs/brand/safeer-logo-official.svg`, and the app's mark, lockup, PNG and favicons are built from it by `scripts/build-brand.mjs` (`docs/frontend/client-content.md` §1).
- **Content collected from the current site:** figures, registration number and date, contact details, board. See `docs/frontend/client-content.md` for where each goes (admin screens) and what is still open.
- **Content:** all real copy, figures and photos. Every `[…]` placeholder comes from fixtures or the translation files. That covers impact numbers, board bios and photos, partner logos, the governance documents, the office hours and reply time on the contact page, and the map embed.
- **Hosting:** the Node versions offered by the Hostinger plan (see `deployment.md`).

---

## 7. Commands and CI

```bash
nvm use                      # Node 24.21.0 (.nvmrc); runtime supports 22.x/24.x
npm ci
npm start                    # ng serve with environment.useMocks (in-app mock backend)
npm run build                # production SSR build → dist/safeer_web
npm run serve:ssr            # node dist/safeer_web/server/server.mjs (needs .env, see .env.example)
npm run lint                 # ng lint + lint-styles + prettier --check
npm run format
npm run test:ci              # unit
npm run test:server          # server + scripts
npm run build:ci             # prod build + gzip budget (<150 KB) + prod-artifact check + e2e build
npm run build:e2e
npx playwright test          # PR matrix (390/1440 × ar/en, + dark at 1440)
npm run e2e:full             # full 6×2 matrix, light + dark
npm run lighthouse           # after npm run build: home, news, article (mobile)
npm run mock-api             # standalone mock API on :3100
```

**CI** (`.github/workflows/ci.yml`, on pull_request, push to main, nightly and on demand; cancel-in-progress), three jobs:
- `build-test`: `npm ci` → lint → unit → server tests → `build:ci` → cached Playwright Chromium → e2e against the mock → upload the report and screenshots.
- `e2e-real` (W24): MySQL 8 service → `safeer_api` at `vars.SAFEER_API_REF` (default `v1.0.0-rc1`) → `npm ci && npm run build` there → `node scripts/real-api.mjs safeer_api --detach` → `build:e2e` → e2e with `E2E_API_URL` (`@mock-only` dropped) → upload the report and `api.log`.

To run the real-API suite locally, see the README ("Run e2e against the real API locally"). `node scripts/record-fixtures.mjs` re-records the public fixtures from that API.

- `lighthouse`: production build → `npm run lighthouse` (`LH_RUNS=7`) → upload `.lighthouseci/`.

**Nightly** (cron `30 1 * * *` in `ci.yml`) and the `full-matrix` PR label set `E2E_FULL_MATRIX=1` for both e2e jobs: 6 viewports × 2 locales, each in light and dark.

---

## As-built routes (Phases 0–10)

| Route | Mode | Notes |
|---|---|---|
| `/` | server 302 | `/ar`, or `/en` from the `lang` cookie; `Vary: Cookie` |
| `/:lang` | SSR | Home |
| `/:lang/about`, `/board`, `/work-areas`, `/scholarships`, `/testimonials`, `/partners`, `/documents`, `/contact` | SSR | Public pages |
| `/:lang/news`, `/news/:slug` | SSR | `?category&q&page`; `?preview=` |
| `/:lang/newsletter/confirm`, `/newsletter/unsubscribe` | SSR shell | `?token=`; noindex |
| `/:lang/apply` | SSR | Apply flow |
| `/:lang/portal/login` | CSR | `?returnUrl=` |
| `/:lang/portal`, `/:lang/portal/documents` | CSR | `applicantGuard` |
| `/:lang/admin/login`, `/admin/forgot` | CSR | Staff sign-in, forgot password |
| `/:lang/admin`, `/admin/forbidden` | CSR | Overview (role-aware), no-access page |
| `/:lang/admin/applications`, `/admin/applications/:id` | CSR | `?status&q&reviewer&page`; area `applications` |
| `/:lang/admin/messages`, `/admin/messages/:id` | CSR | `?status&page`; area `inbox` |
| `/:lang/admin/pages`, `/admin/pages/:id` | CSR | area `content`; sections editor |
| `/:lang/admin/news`, `/admin/news/new`, `/admin/news/:id`, `/admin/news/categories` | CSR | `?filter&q&page`; area `content` |
| `/:lang/admin/work-areas`, `/board`, `/partners`, `/documents`, `/stats`, `/about-items`, `/media` | CSR | area `content`; `?tab=` where the collection has tabs |
| `/:lang/admin/testimonials` | CSR | area `inbox`; themes + testimonials |
| `/:lang/admin/redirects`, `/admin/interview-slots`, `/admin/newsletter` | CSR | areas `content`, `applications`, `inbox` |
| `/:lang/admin/system/users`, `/system/settings`, `/system/mail`, `/system/sms`, `/system/audit` | CSR | areas `users`, `settings`, `audit`; mail/SMS `?tab=` settings, templates or log |
| `/:lang/admin/account` | CSR | any staff member |
| `/:lang/admin/accept/:token`, `/:lang/admin/reset/:token` | CSR | Public; set a password from the mailed link (W16) |
| `/:lang/_kit` | SSR | dev and e2e builds only |
| `/:lang/**` | SSR | 404 page, status 404 |
| `/**` | SSR | Bare 404 |
| `/healthz`, `/robots.txt`, `/sitemap.xml` | server | Everything the server serves itself is br/gzip compressed (Phase 10) |
| `/api/**`, `/files/**` | proxy | To `API_INTERNAL_URL` |
| Legacy WordPress paths | server | 301 via `redirects/resolve`, or 410 for clinic-template paths |

## Final screen table (plan §6.1–6.2)

| Screen | Route | API calls | Test file | Status |
|---|---|---|---|---|
| Header / footer | every public page | `GET /site` | `e2e/specs/shell.spec.ts` | Done |
| Home | `/:lang` | `GET /home` | `pages-home-board.spec.ts`, `placeholder.spec.ts` | Done |
| About | `/:lang/about` | `GET /pages/about`, `GET /about-items?kind=vision,mission,goal` (B18) | `pages-a.spec.ts` | Done |
| Board | `/:lang/board` | `GET /pages/board`, `GET /board` (`{board, executive}`) | `pages-home-board.spec.ts` | Done |
| Work areas | `/:lang/work-areas` | `GET /pages/work`, `GET /work-areas`, `GET /testimonials` (themes) | `pages-a.spec.ts` | Done |
| Scholarships | `/:lang/scholarships` | `GET /pages/scholarships`, `GET /about-items?kind=care_pillar,scholarship_step,requirement` | `pages-a.spec.ts` | Done |
| News list | `/:lang/news` | `GET /pages/news`, `GET /news`, `/news/featured`, `/news-categories`, `POST /newsletter` | `news.spec.ts` | Done |
| Article | `/:lang/news/:slug` | `GET /news/:slug`, `/news-categories` | `news.spec.ts` | Done |
| Newsletter confirm / unsubscribe | `/:lang/newsletter/{confirm,unsubscribe}` | `POST /newsletter/confirm`, `/newsletter/unsubscribe` `{email, token}` (C27) | `news.spec.ts` | Done |
| Testimonials | `/:lang/testimonials` | `GET /pages/testimonials`, `GET /testimonials` | `pages-b.spec.ts` | Done |
| Partners | `/:lang/partners` | `GET /pages/partners`, `GET /partners` | `pages-b.spec.ts` | Done |
| Documents | `/:lang/documents` | `GET /pages/documents`, `GET /documents` | `pages-b.spec.ts` | Done |
| Contact | `/:lang/contact` | `GET /pages/contact`, `POST /contact` | `contact.spec.ts` | Done (map loads on click, A12) |
| Apply | `/:lang/apply` | `GET /meta/countries`, `POST /applications`, `PATCH /portal/application`, `GET/POST/DELETE /portal/documents`, `POST /portal/application/submit`, `GET /portal/me` | `apply.spec.ts`, `apply-payload.spec.ts`, `apply-draft.spec.ts` | Done; e2e against both APIs |
| Portal login | `/:lang/portal/login` | `POST /portal/auth/request-otp`, `verify-otp` | `portal.spec.ts` | Done |
| Portal status | `/:lang/portal` | `GET /portal/me`, `/portal/notifications`, `/portal/interview-slots`, `POST/DELETE /portal/interview`, `PATCH /portal/application/corrections` | `portal.spec.ts` | Done |
| My documents | `/:lang/portal/documents` | `GET/POST /portal/documents`, `/portal/documents/:id/file` | `portal.spec.ts`, `portal-rules.spec.ts` | Done (B3 rules) |
| 404 / 500 / 503 | any | n/a | `shell.spec.ts`, `server-routing.spec.ts` | Done |
| Staff invitation / reset | `/:lang/admin/{accept,reset}/:token` | `POST /admin/auth/accept/:token`, `/admin/auth/reset/:token` | `admin-set-password.spec.ts` | Done (W16) |
| Admin login / forgot | `/:lang/admin/login`, `/admin/forgot` | `POST /admin/auth/login`, `/admin/auth/forgot`, `GET /admin/me`, `/admin/roles` | `admin-auth.spec.ts` | Done (Phase 7) |
| Admin shell + overview | `/:lang/admin` | `GET /admin/overview` | `admin-shell.spec.ts` | Done (Phase 7) |
| Applications | `/:lang/admin/applications` | `GET /admin/applications`, `/counts`, `/assignees`, `/export.csv`, `POST /bulk` | `admin-applications.spec.ts` | Done (Phase 7) |
| Application review | `/:lang/admin/applications/:id` | `GET/PATCH /admin/applications/:id`, `POST …/request-documents`, `PATCH …/documents/:docId`, `GET …/file`, `POST …/notes` | `admin-applications.spec.ts` | Done (Phase 7) |
| Messages | `/:lang/admin/messages[/:id]` | `GET /admin/messages[/:id]`, `POST …/reply`, `PATCH`, `POST …/convert-to-testimonial`, `DELETE` | `admin-messages.spec.ts` | Done (Phase 7) |
| Admin pages + page editor | `/:lang/admin/pages[/:id]` | `admin/pages`, `admin/page-sections` (list, create, `PATCH`, `/publish`, `/reorder`, delete) | `admin-content.spec.ts` | Done (Phase 8) |
| Admin news list / editor | `/:lang/admin/news`, `/new`, `/:id` | `admin/news` (+ `/publish`, `DELETE /legacy`), `admin/news-categories`, `admin/preview-token`, `admin/media` | `admin-content.spec.ts`, `news.spec.ts` | Done (Phase 8) |
| Admin work areas | `/:lang/admin/work-areas` | `admin/work-areas`, `admin/work-area-items` | `admin-content.spec.ts` | Done (Phase 8) |
| Admin board | `/:lang/admin/board` | `admin/board` | `admin-content.spec.ts` | Done (Phase 8) |
| Admin testimonials | `/:lang/admin/testimonials` | `admin/testimonials` (+ `/status`, `/feature`), `admin/testimonial-themes` | `admin-content.spec.ts`, `pages-b.spec.ts` | Done (Phase 8) |
| Admin partners | `/:lang/admin/partners` | `admin/partners` | `admin-content.spec.ts` | Done (Phase 8) |
| Admin documents | `/:lang/admin/documents` | `admin/documents`, `admin/doc-categories`, `admin/media` | `admin-content.spec.ts` | Done (Phase 8) |
| Admin figures / about items | `/:lang/admin/stats`, `/about-items` | `admin/stats`, `admin/about-items` | `admin-content.spec.ts` | Done (Phase 8) |
| Media library | `/:lang/admin/media` | `GET/POST admin/media`, `PATCH` (alt), `DELETE` | `admin-content.spec.ts` | Done (Phase 8) |
| Users and permissions | `/:lang/admin/system/users` | `admin/users` (GET, PATCH, DELETE), `POST admin/auth/invite`, `GET admin/roles` | `admin-system.spec.ts` | Done (Phase 9) |
| Settings | `/:lang/admin/system/settings` | `GET/PUT admin/settings`, `admin/cache/stats`, `DELETE admin/cache` | `admin-system.spec.ts` | Done (Phase 9) |
| Email / SMS | `/:lang/admin/system/mail`, `/system/sms` | `admin/{mail,sms}/settings`, `/test`, `/templates[/:key[/preview]]`, `/log`, `mail/log/:id/retry` | `admin-system.spec.ts` | Done (Phase 9) |
| Activity log | `/:lang/admin/system/audit` | `GET admin/audit` | `admin-system.spec.ts` | Done (Phase 9) |
| Redirects | `/:lang/admin/redirects` | `admin/redirects` | `admin-system.spec.ts`, `shell.spec.ts` | Done (Phase 9) |
| Newsletter | `/:lang/admin/newsletter` | `GET admin/newsletter`, `/export.csv`, `DELETE` | `admin-system.spec.ts` | Done (Phase 9) |
| Interview slots | `/:lang/admin/interview-slots` | `admin/interview-slots` | `admin-system.spec.ts`, `portal.spec.ts` | Done (Phase 9) |
| My account | `/:lang/admin/account` | `PATCH admin/auth/password`, `admin/auth/sessions` | `admin-system.spec.ts` | Done (Phase 9) |
| Anonymise an application | review screen | `DELETE admin/applications/:id` | `admin-system.spec.ts` | Done (Phase 9) |
