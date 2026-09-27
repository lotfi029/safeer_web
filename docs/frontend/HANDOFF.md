# safeer_web — Session 1 handoff

Session 1 (Phases 0–6) is done. It covers the public site, the apply flow and the student portal. The admin area has only its auth plumbing. Session 2 should read this file first, then `docs/safeer-frontend-sessions-plan.md` Part B.

- **PRs:** stacked draft PRs lotfi029/safeer_web#1 through #7, one per phase.
- **Base branches:** each phase branched from the previous `feat/phase-N` because nothing was merged yet.
- **Merge order:** merge in order #1 → #7, then this PR.
- **Test totals at exit:**
  - lint clean
  - unit tests: 46 files, 163 tests
  - server tests: 52
  - e2e: **311/311** on the full 6 viewports × ar/en matrix
  - initial bundle: **135.9 KB gzip** (limit 150)

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
| Per-endpoint `LIVE_ENDPOINTS` mock toggle | **Not done.** Mocks are all-or-nothing: `environment.useMocks` for `ng serve`, and the Node mock API for e2e. Setting `E2E_API_URL` runs e2e against a real API. | Nothing was live yet to toggle. Add a path allow-list in `mock-backend.interceptor.ts` when the first B-item lands. |
| `src/app/core/api/contract-assumptions.md` | Not created. The assumptions are listed in §6 below. | `docs/api/CONTRACT-NOTES.md` covered almost everything. |
| Apply form "hydrates on interaction" | Normal hydration at bootstrap | Deferred hydration resets values typed before it runs. |
| Newsletter band `hydrate on viewport` | Plain `@defer (on viewport)`, rendered in the browser only | Same reason. It's below the fold and not needed for SEO. |
| Contact map facade loads an iframe on click | Done (A12): a "show the map" button loads `settings.mapEmbedUrl` in an iframe, only when it is a Google Maps embed or OpenStreetMap URL (`shared/map/map-embed.ts`). "Open in maps" uses `mapLat`/`mapLng`, or the address. | `frame-src` allows exactly those two origins. Nothing third-party loads until the visitor clicks. |
| Scholarship steps as `app-timeline` | Custom rail (vertical below xl, 5-column row at xl) | `app-timeline` models done/now/pending states, which don't fit static numbered steps. |
| Prototype: `scholarshipNote` in apply step 3 | Step 2 | Follows the plan. |
| Prototype: single OTP text input | 6-box `app-otp-input` | Follows the brief. |
| Eyebrow colour `--secondary` | New token `--secondary-text: #197679` | `#1c8184` on `--surface` is 4.41:1, below AA. The new token is 5.1:1. |

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
| `PublicApi` | site, home, pages, about-items, board, work-areas, news, testimonials, partners, documents, countries, sitemap-index, contact, newsletter + confirm/unsubscribe |
| `PortalApi` | applications, portal me/patch/submit, documents (upload with `reportProgress`), notifications, interview slots/book/cancel, OTP auth |
| `StaffApi` | admin auth, `/admin/me`, `/admin/roles`. **Session 2 adds the admin feature APIs here or in sibling services.** |

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
| `apiBaseUrl` | Prefixes the API base URL |
| `serverForward` (SSR only) | XFF + Accept-Language from the request, 5 s timeout |

The HTTP transfer cache carries only anonymous public GETs.

**Stores and guards** (`core/auth/`)

- `StaffSessionStore`
  - `me` and `csrfToken`, loaded from `/admin/me`.
  - Guards: `staffGuard`, `staffLoginGuard`.
  - `roleGuard` reads `data.area` and checks `GET /admin/roles` (B17, mocked), falling back to `role-matrix.ts`.
- `ApplicantSessionStore`
  - `me` and `canWrite`.
  - `startSession(csrf)` is called after `POST /applications` and after `verify-otp`.
  - `refresh()` re-reads `/portal/me`; its `csrfToken` (B16) keeps writes working after a reload.
  - `onClear()` fires on logout and 401.
  - Guards: `applicantGuard`, `applicantLoginGuard`.

**Adding an endpoint and its mock**

1. Add the method to the right service. For a new response shape, add the type to `models.ts`.
2. Add a route in `mocks/backend.mjs` as `[METHOD, /^\/api\/v1\/…$/, ({lang, query, params, body, req}) => json(…) | problem(…)]`.
3. For fixture data, create `mocks/fixtures/<name>.json` and list it in `mocks/fixtures.mjs`.
   - Bilingual fields use the `xAr`/`xEn` pair, which `collapseBilingual` resolves per language.
   - **Only spec content or `[…]` placeholders. Never invent content.**
4. The same backend serves both `ng serve` (in-app interceptor) and the e2e mock API (`e2e/mock-api/server.mjs`, port 3100), so one change covers both.

The e2e mock has these test-only routes:
- `/api/v1/__echo`
- `GET` / `DELETE /__log`
- `POST /__reset`, with `?reference=SA-…` to restore a single seeded application

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
- Admin strings live under `admin.*`; Session 2 should add `translations/admin/*.ts` the same way.
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
- **Offline draft** (`apply-draft.ts`): sessionStorage, 24 h TTL, never stores ID number or birth date (F5).
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
- A value typed into a server-rendered field *before* hydration can be reset when the component hydrates.
- Keep critical forms eagerly hydrated. Render below-the-fold forms client-side (`@defer (on viewport)` with no `hydrate`).
- In e2e, wait for `networkidle` before typing.

**Lint**
- `npm run lint` runs ng lint (angular-eslint with template a11y rules as errors and OnPush required), lint-styles and prettier (with the Tailwind plugin).

---

## 5. Test tooling

- **Unit:** `npm run test:ci`. Vitest on jsdom via `ng test`, specs are `src/**/*.spec.ts`.
- **Server and scripts:** `npm run test:server`. Vitest on node (`vitest.server.config.mts`), specs are `src/server/*.test.ts` and `scripts/*.test.mjs`.
- **e2e:** `npx playwright test` (set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` in this container).
  - `webServer` starts the mock API (3100), the SSR build from `dist/safeer_web-e2e` (4100), and a second SSR server pointed at a dead API (4101).
  - Build first with `npm run build:e2e`: production optimisations, CSP enforced, `/_kit` included.
  - `E2E_API_URL` switches to a real API. Mock-only tests `test.skip(!usingMockApi)`.
- **Matrix helper** (`e2e/support/matrix.ts`)
  - `matrix()` gives 390 and 1440 × ar/en per PR. With `E2E_FULL_MATRIX=1` it covers 360/390/768/1024/1440/1920 × ar/en, which runs nightly and on the `full-matrix` label.
  - `openAt(page, path, viewport, locale, theme?)` opens the page with reduced motion.
  - `checkScreen(page, testInfo, name, viewport, locale)` checks for no horizontal scroll, runs axe (serious or critical fails), and takes a screenshot.
- **Screenshots**
  - Viewport-only, palette-compressed to ≤150 KB, attached to every test.
  - With `E2E_SCREENS_DIR=docs/frontend/screens/phase-N`, the 390 and 1440 shots are written as `{screen}-{ar,en}-{390,1440}.png`.
- **Fixtures**
  - `mocks/fixtures/*.json`, one source for dev and e2e (F6).
  - Mock credentials: OTP `123456`; staff `admin|reviewer|editor|support@mock.invalid` with password `mock-password`.
  - Seeded applications `SA-2026-00101…00107`, one per status.
  - Tokens: newsletter `mock-token`, article preview `mock-preview`.
  - Portal specs run serially and restore their application with `__reset?reference=`.
- **Prod artifact:** `scripts/check-prod-artifact.mjs` fails if the production build contains the mock registry or the `/_kit` route.

---

## 6. Status

### Backend items (`docs/safeer-backend-fix-prompt.md`)

| Item | Status in this frontend |
|---|---|
| B1 OTP channel choice | UI built, **mocked** (`channel` sent to `request-otp`) |
| B2 phone identifier + `APPLICATION_EXISTS` | UI built, **mocked** |
| B3 re-upload rules | Enforced in the UI (`canUpload`) and the mock |
| B9 clean `/x` button URLs | Fixtures already use `/x`; a legacy `#/x` mapper stays in `core/site/nav-routes.ts` |
| B12 board bio | Rendered when present, **mocked** |
| B15 `GET /sitemap-index` | **Mocked**; `sitemap.xml` depends on it |
| B16 `csrfToken` on `/portal/me` | **Mocked**. Without it, writes after a reload fail (`ApplicantSessionStore.canWrite` is false). |
| B17 `GET /admin/roles` | **Mocked**, with a typed fallback in `core/auth/role-matrix.ts` |
| B18 `GET /about-items?kind=` | **Mocked** (About, Scholarships) |
| B19 public document fields only | Types ignore `storageKey`/`checksum` |
| C2 frontend routes | `/:lang/portal/login`, `/:lang/admin/login` |
| C17 interview in `/portal/me` + `DELETE /portal/interview` | **Mocked** |
| C26 sanitized HTML for section/about bodies | Rendered through `app-rich-text` (re-sanitized) |
| C27 newsletter double opt-in, confirm/unsubscribe | Pages built, **mocked** |
| C35 notifications shape | Used as `[{id, type, createdAt, data}]` |

**Assumed shapes, not yet in `docs/api`**
- `redirects/resolve` → `{toPath, statusCode}`
- `sitemap-index` → `{pages, posts, categories}`
- about-items grouped by kind
- `/portal/me.interview` → `{startsAt, endsAt, location}`
- newsletter confirm/unsubscribe → `POST {token}` → `{ok}`

**Before Session 2 starts:** refresh `docs/api/` from `safeer_api` and remove each mock whose item is live.

### Known issues / TODOs
- **Accordion headings:** `app-accordion-item` puts its heading inside `<summary>`, so work-area titles on mobile aren't headings in the accessibility tree.
- **Filter-bar chips on phones:** in `linkMode` the chips move into a bottom sheet below 480px. The partners page uses plain chip links instead. News keeps the sheet; revisit if SEO reviewers want the links visible.
- **SSR forms and hydration:** see the hydration gotcha in §4.
- **Admin area:** stub login, forbidden page and guarded placeholders only (`features/admin`). The whole dashboard is Session 2.
- **Lighthouse:** not run in Session 1. It's a Session 2 exit criterion.
- **Types:** F11 generated types and the per-endpoint mock toggle are not done (see §1).
- **Portal help card:** links to the contact page because the portal shell doesn't load `/site`.

### Still needed from the client
- **Logo:** the official SVG. `docs/safeer-logo.png` is a temporary stand-in and a launch blocker (spec §6.1).
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
npx playwright test          # PR matrix (390/1440 × ar/en)
npm run e2e:full             # full 6×2 matrix
npm run mock-api             # standalone mock API on :3100
```

**CI** (`.github/workflows/ci.yml`, on pull_request, cancel-in-progress): `lint → unit → build → e2e`.
1. `npm ci`
2. `npm run lint`
3. `npm run test:ci`
4. `npm run test:server`
5. `npm run build:ci`
6. Cached Playwright Chromium
7. `npx playwright test` against the mock, or `vars.E2E_API_URL`
8. Upload the report and screenshots

**Nightly** (`nightly.yml`): cron `17 1 * * *`, `workflow_dispatch`, and the `full-matrix` PR label. It runs `build:e2e` and then the full 6×2 matrix.

---

## As-built routes (Phases 0–6)

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
| `/:lang/admin/login`, `/admin`, `/admin/forbidden`, `/admin/system/users` | CSR | Auth plumbing only |
| `/:lang/_kit` | SSR | dev and e2e builds only |
| `/:lang/**` | SSR | 404 page, status 404 |
| `/**` | SSR | Bare 404 |
| `/healthz`, `/robots.txt`, `/sitemap.xml` | server | |
| `/api/**`, `/files/**` | proxy | To `API_INTERNAL_URL` |
| Legacy WordPress paths | server | 301 via `redirects/resolve`, or 410 for clinic-template paths |

## Final screen table (plan §6.1–6.2)

| Screen | Route | API calls | Test file | Status |
|---|---|---|---|---|
| Header / footer | every public page | `GET /site` | `e2e/specs/shell.spec.ts` | Done |
| Home | `/:lang` | `GET /home` | `pages-home-board.spec.ts`, `placeholder.spec.ts` | Done |
| About | `/:lang/about` | `GET /pages/about`, `GET /about-items?kind=vision,mission,goal` (B18) | `pages-a.spec.ts` | Done (B18 mocked) |
| Board | `/:lang/board` | `GET /pages/board`, `GET /board` | `pages-home-board.spec.ts` | Done (B12 mocked) |
| Work areas | `/:lang/work-areas` | `GET /pages/work`, `GET /work-areas`, `GET /testimonials` (themes) | `pages-a.spec.ts` | Done |
| Scholarships | `/:lang/scholarships` | `GET /pages/scholarships`, `GET /about-items?kind=care_pillar,scholarship_step,requirement` | `pages-a.spec.ts` | Done (B18 mocked) |
| News list | `/:lang/news` | `GET /pages/news`, `GET /news`, `/news/featured`, `/news-categories`, `POST /newsletter` | `news.spec.ts` | Done |
| Article | `/:lang/news/:slug` | `GET /news/:slug`, `/news-categories` | `news.spec.ts` | Done |
| Newsletter confirm / unsubscribe | `/:lang/newsletter/{confirm,unsubscribe}` | `POST /newsletter/confirm`, `/newsletter/unsubscribe` (C27) | `news.spec.ts` | Done (C27 mocked) |
| Testimonials | `/:lang/testimonials` | `GET /pages/testimonials`, `GET /testimonials` | `pages-b.spec.ts` | Done |
| Partners | `/:lang/partners` | `GET /pages/partners`, `GET /partners` | `pages-b.spec.ts` | Done |
| Documents | `/:lang/documents` | `GET /pages/documents`, `GET /documents` | `pages-b.spec.ts` | Done |
| Contact | `/:lang/contact` | `GET /pages/contact`, `POST /contact` | `contact.spec.ts` | Done (map is a static facade) |
| Apply | `/:lang/apply` | `GET /meta/countries`, `POST /applications`, `PATCH /portal/application`, `GET/POST/DELETE /portal/documents`, `POST /portal/application/submit`, `GET /portal/me` | `apply.spec.ts`, `apply-payload.spec.ts`, `apply-draft.spec.ts` | Done (B2, B16 mocked) |
| Portal login | `/:lang/portal/login` | `POST /portal/auth/request-otp`, `verify-otp` | `portal.spec.ts` | Done (B1 mocked) |
| Portal status | `/:lang/portal` | `GET /portal/me`, `/portal/notifications`, `/portal/interview-slots`, `POST/DELETE /portal/interview` | `portal.spec.ts` | Done (C17 mocked) |
| My documents | `/:lang/portal/documents` | `GET/POST /portal/documents`, `/portal/documents/:id/file` | `portal.spec.ts`, `portal-rules.spec.ts` | Done (B3 rules) |
| 404 / 500 / 503 | any | n/a | `shell.spec.ts`, `server-routing.spec.ts` | Done |
