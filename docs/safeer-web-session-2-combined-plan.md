# safeer_web — Session 2 (combined): finish the fix pass, then build the admin dashboard and launch

**Date:** 2026-09-27
**Backend ref:** `safeer_api` `v1.0.0-rc1`. It's final, and `SAFEER_API_REF` is already set.

This file replaces running `safeer-web-fix-pass-2-prompt.md` and `safeer-frontend-session-2-prompt.md` as two separate sessions. **One Claude Code session does both, in two stages.** Stage 1 finishes the Session 1 fix pass on PR #9. Stage 2 builds Phases 7–10 on top of it.

## Why one session works

- The fix pass leaves the session with full context on the code (API layer, stores, mocks, real-API CI). Stage 2 reuses that directly, instead of a fresh session relearning the codebase from HANDOFF.md.
- W16 (the accept/reset pages) overlaps with Phase 7's auth screens, so it moves into Phase 7 and gets built once.
- HANDOFF.md is still refreshed at the end of Stage 1 (W22). If the session runs out of context, a new one can resume from HANDOFF.md plus the last phase report.

## Starting point (verified 2026-09-27)

- **PR #9** (`fix/session-1-review`): lint, unit (170), server (53) and build (136.1 KB gzip) are green, and so is e2e against mocks (174/174).
- **Against the real API:** 96 passed / **20 failed**. 13 are the English header overflowing at 1440 (W5), 4 are the board (W1), and 3 are fixture-bound specs.
- **Done:** W2, W3, W12, W15, W17, W23, and the whole rc1 `API-CHANGES.md` contract (A1–A12).
- **Open:** W1, W4–W11, W13, W14, W16, W18–W22, W24.
- **Admin dashboard:** not started (Phases 7–10).

## Stage 1 — Finish the fix pass (branch `fix/session-1-review`, PR #9)

| Step | Items | Stop? |
|---|---|---|
| **A** | **W24:** `e2e-real` CI job. MySQL 8 service, `safeer_api` at `vars.SAFEER_API_REF` (default `v1.0.0-rc1`), migrate, boot, Playwright with `E2E_API_URL`. Tag the fixture-bound specs `@mock-only`. Pick a rate-limit strategy (spec ordering, or the API's `NODE_ENV=test` throttle opt-in) and justify it. Add a 3-command local recipe to the README. | **Stop: report the real-API failure list.** |
| **B** | **W1** (board `{board, executive}`), **W4** (one document per type, no client-side delete), **W5** (`navLabel` map by slug; no header overflow from 360 to 1920 in ar and en; e2e overflow checks at 1100/1280/1440 against the real API). Add `scripts/record-fixtures.mjs` so fixtures come from real responses. | — |
| **C** | **W6** (don't show CMS labels as eyebrows), **W7** (labelled `[صورة: …]` placeholders; check the home hero and about), **W8** (touch targets ≥ 44px), plus the shared, tested plain-text helper for card leads. | — |
| **D** | **W9:** transfer cache via `HTTP_TRANSFER_CACHE_ORIGIN_MAP` or a server-side backend rewrite. e2e: no `/api/v1` request after hydration, and no internal origin in the HTML. | — |
| | **W10:** clear the draft on logout and 401, and tie it to its `reference`. | — |
| | **W11:** clear the session only on a 401. | — |
| | **W13:** no automatic font preloads; hand-preload the above-the-fold faces. | — |
| | **W14:** shared `core/validation` mirroring the backend (name rules, Arabic-Indic digits in phone numbers). | — |
| **F** | **W18–W21**, then **W22** (refresh HANDOFF.md to the as-built state). | — |
| **Gate 1** | lint, unit, server, `build:ci`; **e2e against mocks and the real API, both green**; screenshots of the fixed screens at 390/1440 in ar/en into `docs/frontend/screens/session-1-fixes/`; a W-table (W1–W24 → fix → commit → test) and the `@mock-only` list with reasons. | **Stop: you merge PR #9.** |

W16 moves to Phase 7.

## Stage 1 result (verified independently, 2026-09-27)

PR #9 @ `631deea`, re-run locally against `safeer_api` `v1.0.0-rc1` booted through the branch's own `scripts/real-api.mjs` (`NODE_ENV=test`, MariaDB 10.11):

| Check | Result |
|---|---|
| lint · unit · server | ✅ · ✅ **190** · ✅ **62** |
| `build:ci` | ✅ 136.5 KB gzip |
| e2e against mocks | ✅ **195/195** |
| **e2e against the real API** | ✅ **141/141** (it failed 20 before this pass) |
| Screenshots | The English header fits (short labels), the board shows both groups, and the hero has no CMS label |

All of W1–W24 are closed, with a test for each. W16 was built in Stage 1 instead of Phase 7; that's fine, and Phase 7 reuses it.

**Carried into Stage 2** (from the session's own report and this review):

1. **54 specs are `@mock-only`**, including **the whole student portal**, so the portal has never been tested against the real API. The API run with `NODE_ENV=test` already has the dev OTP hook (`GET /__dev/otp/:applicationId`). Moving the portal to the real API is Stage 2 Phase 7's first task.
2. **Staff roles on the real API.** The dev seed only has the bootstrap admin, but real-API e2e for admin screens needs one user per role, plus invite and reset tokens. Add `e2e/support/real-db.ts`, used only when `E2E_API_URL` is set. It uses mysql2 against the e2e database the API uses, and argon2 with the API's `ARGON2_OPTIONS`, to seed temp users per role and insert known-hash tokens. It cleans up after itself. This is what the session already did by hand to verify W16.
3. **Contact and newsletter submits.** The API silently drops submits made less than 3 s after the form rendered. The real-API specs wait more than 3 s, or use Playwright's clock.
4. **`CLAUDE.md` is stale.** It still says "mock missing backend features" and points to the old brief. Update it to: real-API e2e is required, no mocks by default, and the entry point is the combined prompt.
5. **Scope rule:** after the step-A incident (commands ran inside `../safeer_api`), never run commands in the API checkout other than `scripts/real-api.mjs` and read-only reads.

## Stage 2 — Admin dashboard and launch (Phases 7–10, one branch and draft PR per phase from the updated `main`)

**Every phase gate includes e2e against the real API.** Admin fixtures are recorded from rc1 responses; hand-written admin fixtures aren't allowed. All the B/C/A backend items are live at rc1, so **no admin endpoint is mocked by default**. If one has to be, list it in that phase's report with the reason.

| Phase | Scope | Est. |
|---|---|---|
| **7 — Admin core** | <ul><li>Shell: sidebar ≥ xl, icon rail at lg, drawer < lg.</li><li>Auth: login, forgot, **reset + accept-invite (W16)**, matching the emailed `/{locale}/admin/accept/{token}` and `/{locale}/admin/reset/{token}` links.</li><li>Overview (role-aware; `unreadMessages` only for admin and support), with the SVG chart.</li><li>Applications list: status tabs and counts, filters, bulk bar, assign dialog (active admin/reviewer only), CSV export.</li><li>Review screen: per-document accept/reject with reason; the viewer only when `downloadPath` isn't null; notes; the action log; transitions from the shared map plus a drift test.</li><li>Messages: two-pane ≥ lg, list → detail on mobile.</li><li>Menu and guards come from `GET /admin/roles` (area keys).</li></ul> | 5 d |
| **8 — Admin content** | <ul><li>Config-driven `CrudList` + `CrudForm`: bilingual pairs, drag plus keyboard reorder, publish toggle, delete by `*.delete` area.</li><li>Configured for work areas and their items (with the item visibility toggle), board (bio), testimonials and themes, partners, documents and categories, stats, about-items.</li><li>Hand-built: the pages list (`sectionsCount`) with a section editor and preview; news with a markdown editor and preview, the `COVER_MISSING` warning as a notice, slug rules, and the legacy bulk delete.</li><li>Media library, alt text required.</li></ul> | 5 d |
| **9 — Admin system** | <ul><li>Users: invite, role, `status` active/disabled/invited, unlock, the roles matrix table.</li><li>Settings: org details, SEO, socials, map fields `mapEmbedUrl`/`mapLat`/`mapLng` with the host allow-list.</li><li>Mail and SMS: settings, templates, test send, logs (codes are masked).</li><li>Audit (admin only), redirects (validation, chain errors), newsletter plus CSV, interview slots (time validation; editing a booked slot notifies the applicant), account (password, active sessions).</li><li>Admin application delete/anonymise, with a confirm dialog.</li></ul> | 2.5 d |
| **10 — Hardening and launch** | <ul><li>Motion polish.</li><li>The full Playwright matrix: every screen × 6 viewports × 2 locales, plus light and dark, on mocks **and** the real API.</li><li>axe: zero serious or critical issues.</li><li>Lighthouse CI (mobile) on home, news and article: A11y/BP/SEO ≥ 95, Perf ≥ 90.</li><li>CSP re-checked on every route type, including the map `frame-src`.</li><li>`docs/frontend/deployment.md` (Hostinger Node app, PM2, env vars, runtime Node version, the API bound to localhost, `TRUST_PROXY`, backups).</li><li>Final README; HANDOFF.md at its final state.</li></ul> | 3 d |

**Stops:** after each of Phases 7, 8, 9 and 10. Each report has the gate results (including real-API e2e), screenshots at 390/1440 in ar/en in `docs/frontend/screens/phase-N/`, any mocks with reasons, and deviations.

**Total:** Stage 1 ≈ 3–4 days, Stage 2 ≈ 15.5 days.

## Definition of done

- All 29 prototype screens, plus 404/500, have working API-backed counterparts, listed in a final table: screen → route → API calls → test file → status.
- CI is green on both the mock and real-API e2e jobs: lint, unit, server, build + gzip, the full matrix, axe, Lighthouse.
- The site can be browsed in ar (RTL) and en (LTR) at 360 and 1440 with no layout breaks.
- HANDOFF.md and deployment.md reflect the final state. The next step is a staging deploy of both apps on Hostinger, then one full real journey: apply → OTP → documents → review → interview → decision.
