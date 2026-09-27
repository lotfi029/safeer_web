# safeer_web — Fix pass status review + plan for the next session

**Date:** 2026-09-27
**Branches checked:**
- `safeer_web` `fix/session-1-review` @ `cf40539`
- `safeer_api` `fix/delivery-followups-2` @ `7e4792a`, tag `v1.0.0-rc1`

All checks below were run locally: MariaDB 10.11 with `SIMULTANEOUS_ASSIGNMENT` on, and Node 24.21.

## 1. Backend: finish before the frontend continues

| Check | Result |
|---|---|
| PR #6 (A5–A12) + the A10 test fix `7e4792a` | ✅ **508/508** tests. The A10 test passed **10 of 10** repeated runs; the old version failed 1 in 3. |
| Tag `v1.0.0-rc1` | ⚠️ It points at `e86b3b5`, a commit on the unmerged PR branch from **before** the A10 test fix. It isn't on `main`. |

**Decision:** keep `v1.0.0-rc1`. The only later commit (`7e4792a`) changes a test file, so the code at rc1 is the API the frontend tests against. `SAFEER_API_REF=v1.0.0-rc1` is already set.

**To do (you):** merge PR #6 once CI is green on both databases. Optionally tag the merge commit `v1.0.0` (or `rc2`) later, when you want the pinned ref to sit on `main`. That doesn't block the frontend.

## 2. Frontend fix pass: what the first run did

**Scope so far:** 3 commits.
- The review docs.
- **W23**: re-snapshot of the contract from rc1 (`scripts/snapshot-api.mjs`).
- A large contract-adoption commit: everything in `API-CHANGES.md`, A1–A12 included.

The contract-adoption commit is good work:
- the A1/A4 message changes
- A9 429 handling
- C17 interview shapes, C15 `correct()`
- a safe map facade (click-to-load, host allow-list, CSP `frame-src` limited to exactly Google and OSM)
- the newsletter `{email, token}` fix
- unknown category → 404
- the real role-matrix keys
- tests for each

**Gate on the branch:**

| Check | Result |
|---|---|
| lint · unit · server | ✅ · ✅ 170 · ✅ 53 |
| build + gzip budget | ✅ 136.1 KB |
| e2e against mocks | ✅ 174/174 |
| **e2e against the real API** (rc1 code) | ❌ **96 passed / 20 failed / 58 skipped**: the same 20 failures as the delivery review |

**The main deviation:** the prompt said to do **W24 (real-API CI) first** and to report the real-API failures before fixing anything. W24 wasn't done: there's still no `e2e-real` job, `SAFEER_API_REF`, or `@mock-only` tags. So the branch still can't show whether a fix works against the real API. That's why the board (W1) and header (W5) breaks are still there, and nothing flagged them.

### W-item status

| Item | Status | Evidence |
|---|---|---|
| W2 notifications / event types | ✅ | Paged shape plus the real event set |
| W3 newsletter `{email, token}` | ✅ | `newsletter-token.ts` |
| W12 unknown category → 404 | ✅ | `loaded.ts` / `news.resolvers.ts` |
| W15 real role-area keys | ✅ | `role-matrix.ts` + fixture |
| W17 error codes | ✅ | `problem.ts` (+ DOCUMENT_SUPERSEDED, INVALID_ASSIGNEE, REDIRECT_CHAIN) |
| W23 contract snapshot | ✅ | `docs/api` from rc1 |
| **W24 real-API CI + `@mock-only`** | ❌ **not started** | No job in `.github/workflows`. The fixture-bound specs (partners chip, `/files/doc-…`, testimonials blockquote) still fail against the real API. |
| **W1 board shape** | ❌ | `public-api.ts:63` is still `BoardMember[]`. The board fails at all 4 viewports against the real API. |
| **W4 one document per type** | ❌ | `apply-documents.ts:31` still has `SINGLE` / `[multiple]` and the client-side delete |
| **W5 English header overflow** | ❌ | 13 `en @1440` specs fail on horizontal overflow. There's no `navLabel`. |
| W6 CMS label as eyebrow | ❌ | Not touched |
| W7 labelled image placeholders | ⚠️ verify | The image component supports `[صورة: …]`, but the home hero and about images showed blank boxes |
| W8 touch targets | ❌ | Not touched |
| **W9 transfer cache** | ❌ | No origin map or backend rewrite. Double fetches, and the internal URL still shows in page source. |
| W10 draft cleared on logout | ❌ | `onClear` still has no subscriber |
| W11 refresh clears only on 401 | ❌ | `applicant-session.store.ts:54` still uses `catch { clear() }` |
| W13 font preloads | ❌ | Not touched |
| W14 shared validation | ❌ | No `core/validation`. The phone regex is still ASCII-only, and `apply.ts` still imports from `contact.ts`. |
| W16 accept/reset pages | ❌ | No routes, so emailed invite and reset links still 404 |
| W18 preview flag | ❌ | Still `of(!!preview)` |
| W19 `noindex()` clears tags | ❌ | Not touched |
| W20 extra socials in footer | ⚠️ verify | The footer references them; confirm all four render when set |
| W21 dead code / stray file | ❌ | `sitemapIndex()` and `shot-tmp.mjs` are still there |
| W22 HANDOFF.md | ❌ | Not refreshed |

## 3. Plan for the next session (fix pass, part 2)

Same branch `fix/session-1-review`, same draft PR, one commit per group. Stop after step A and report, then continue through the rest without stopping unless something is blocked.

**A. W24: real-API CI first. Nothing else starts until this job is running.**
1. Add a CI job `e2e-real` in `.github/workflows/ci.yml`:
   - MySQL 8 service.
   - Check out `lotfi029/safeer_api` at `vars.SAFEER_API_REF` (default `v1.0.0-rc1`).
   - `npm ci`, `build`, `migrate` with the API's own CI env: `NODE_ENV=development`, `FRONTEND_BASE_URL`, bootstrap admin, `DB_*`, `APP_ENCRYPTION_KEY`.
   - Boot the API, then run Playwright with `E2E_API_URL`.
2. Tag the fixture-bound specs `@mock-only` and skip them in `e2e-real`: partners chip names, `/files/doc-*` ids, the testimonials blockquote when the seed has no published testimonial, and exact counts.
3. **Rate limits.** Order the real-API specs so they stay within the API's per-IP limits (applications 5/h, OTP 5/h, contact 3/h). If they can't, use the API's test throttle bypass: `NODE_ENV=test` plus the `x-test-enforce-throttle` opt-in. Check whether running the API with `NODE_ENV=test` in this job is viable, and pick one approach.
4. Add a README section: "run e2e against the real API locally" in 3 commands.
5. **Report:** the real-API failure list at this point. I expect the same 20: 13 are W5, 4 are W1, 3 are fixture-bound.

**B. Real-API breaks.**
- **W1:** the board type becomes `{board, executive}`. Fix the fixture from a recorded real response.
- **W4:** every document type is single; drop `[multiple]` and the client-side delete.
- **W5:** add a `navLabel` map keyed by slug in both languages, falling back to the API title. The header must never overflow from 360 to 1920 in either language. Add e2e overflow checks at 1100/1280/1440 against the real API.
- Add `scripts/record-fixtures.mjs`, which regenerates the public fixtures from a running API.

**C. UX:** W6, W7 (verify on the home hero and about, and fix wherever a blank box shows), W8.

**D. Security, correctness and performance:**
- **W9:** transfer cache via `HTTP_TRANSFER_CACHE_ORIGIN_MAP` or a server-side backend rewrite. Add an e2e test: no `/api/v1` request after hydration on `/ar`, `/en/news` and an article, and the internal origin never appears in the HTML.
- **W10, W11:** draft cleared on logout and 401, the draft tied to its `reference`, and the applicant session cleared only on a 401.
- **W13:** fonts no longer preloaded by the critical-CSS inliner; hand-preload only the 1–2 faces used above the fold for each language.
- **W14:** shared `core/validation` mirroring the backend (`personName`, phone with Arabic-Indic digits normalised).

**E. Session 2 prerequisite, W16:** working `/:lang/admin/accept/:token` and `/:lang/admin/reset/:token` pages (public `POST admin/auth/accept|reset/:token`), with e2e tests against the real API using the API's dev-only token path if one exists. If not, test with the mock and verify manually against the real API.

**F. Low items and docs:** W18, W19, W20 (verify), W21, then **W22** (HANDOFF.md) last, reflecting the final state.

**Gate before the final report:**
- lint, unit, server, `build:ci`
- **e2e against mocks and the real API, both green**
- screenshots at 390 and 1440 in ar and en of the board, home, the header in English, contact and apply, into `docs/frontend/screens/session-1-fixes/`

**Final report:** a table of W-item → fix → commit → test, and the `@mock-only` list with the reason each can't run against the real API.
