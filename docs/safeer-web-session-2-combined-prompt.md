# Prompt — safeer_web Session 2 (combined): finish the fix pass, then build the admin dashboard and launch

> Run Claude Code on `safeer_web` (attach `safeer_api` too if you can) and paste everything below the line.
> This replaces running `safeer-web-fix-pass-2-prompt.md` and `safeer-frontend-session-2-prompt.md` separately.

---

You are continuing **safeer_web**, the Angular 22 SSR frontend for **جمعية سفير الدعوية**. The backend is final at `safeer_api` **`v1.0.0-rc1`**, and the repo variable `SAFEER_API_REF` is set. This session has **two stages**:
- **Stage 1:** finish the Session 1 fix pass on `fix/session-1-review` (draft PR #9).
- **Stage 2:** build the admin dashboard and launch hardening (Phases 7–10).

## Read first
1. `docs/safeer-web-session-2-combined-plan.md`: **the plan you follow.** It has the verified starting point, Stage 1 steps A–F, the Stage 2 phases and every stop point.
2. `docs/safeer-delivery-review.md` §4: the definitions of W1–W24.
3. `docs/safeer-web-fix-pass-2-plan.md` §2: the verified status of each W-item on PR #9.
4. `docs/frontend/HANDOFF.md`, `docs/api/` (rc1 snapshot + `CONTRACT-NOTES.md`), and `docs/safeer-frontend-plan.md` §6.3, §7 and §8.
5. `docs/safeer-frontend-implementation-prompt.md` (hard rules), `docs/safeer-frontend-sessions-plan.md` (R1–R11), `docs/safeer-design-spec.md` §5, and `docs/safeer-prototype.html`. Screenshot every admin screen before building it.

## The one rule that matters most
PR #9 is green against mocks but **fails 20 e2e specs against the real API**: the English header overflows (W5), the board page breaks (W1), and 3 specs assert fixture data. The previous run skipped the real-API CI job (W24), so nothing surfaced these failures. **From now on, nothing counts as fixed or done until it passes e2e against the real API as well as the mocks.** Build that job first.

## Stage 1 — Finish the fix pass (PR #9, branch `fix/session-1-review`)
Already done, don't redo:
- W2, W3, W12, W15, W17 and W23
- the whole rc1 `API-CHANGES.md` contract (`cf40539`)
- the test-only mock route `POST /__site`, which stays

Then:
- **A. W24:** the `e2e-real` job, `@mock-only` tags, a rate-limit strategy (justify it), and a README recipe. **Stop and report the real-API failure list.**
- **B.** W1, W4, W5, plus `scripts/record-fixtures.mjs`.
- **C.** W6, W7, W8, plus a shared, tested plain-text helper for card leads.
- **D.** W9, W10, W11, W13, W14.
- **F.** W18–W21, then W22 (refresh HANDOFF.md).
- **W16 moves to Phase 7**, with the rest of the auth screens.

After A is approved, run B→F without stopping unless something is blocked. **Gate 1:**
- lint, unit, server and `build:ci`
- e2e against mocks and the real API, both green
- screenshots at 390 and 1440 in ar and en in `docs/frontend/screens/session-1-fixes/`
- a W1–W24 table (fix → commit → test) and the `@mock-only` list with reasons

**Stop. I merge PR #9.**

## Stage 2 — Phases 7–10 (one branch `feat/phase-N` + draft PR per phase, from the updated `main`)
Follow the plan's Stage 2 table.
- **Phase 7:** admin core, including W16 (reset/accept-invite pages matching the emailed `/{locale}/admin/accept/{token}` and `/{locale}/admin/reset/{token}` links).
- **Phase 8:** content (config-driven CRUD kit + pages/news editors + media).
- **Phase 9:** system screens.
- **Phase 10:** hardening, Lighthouse, deployment docs, final HANDOFF.

Rules for Stage 2:
- **Every phase gate includes e2e against the real API.** Admin fixtures are recorded from rc1 responses (`record-fixtures.mjs`), never hand-written. Everything the admin needs is live at rc1, so **nothing is mocked by default**. List any exception with its reason.
- Admin screens are `RenderMode.Client` with `no-store` + `noindex`, and **fully usable at 390px**: tables become card lists, decision buttons sit in a sticky footer, and bulk actions work through a selection mode.
- Role access follows `GET /admin/roles` exactly: area keys, plus `*.delete` for delete buttons. Applicant data and documents appear only for admin and reviewer. Show a document link only when `downloadPath` is non-null.
- Handle the rc1 behaviours:
  - the `COVER_MISSING` warning appears as a non-blocking notice
  - slug and redirect validation errors (`REDIRECT_CHAIN`, …) show next to their fields
  - `users.status` is active, disabled or invited
  - the map settings host allow-list is respected
  - interview slot time validation
- After each phase, report:
  - the gate results
  - screenshots at 390 and 1440 in ar and en in `docs/frontend/screens/phase-N/`
  - mocks, if any
  - deviations

  **Then stop and wait for my OK.**

## General rules
- Hard rules and R1–R11 still apply. Don't regress CSP (including `frame-src`), the proxy, SSR status codes or accessibility.
- Never merge, never force-push, never modify `safeer_api`.
- If context runs short, make sure HANDOFF.md plus your last report are enough for a fresh session to resume, and say so.

## Definition of done
- All 29 prototype screens plus 404/500 work against the real API. Final table: screen → route → API calls → test file → status.
- CI is green on the mock and real-API jobs: lint, unit, server, build + gzip, the full matrix, axe and Lighthouse.
- The site can be browsed in ar and en at 360 and 1440 with no layout breaks.
- HANDOFF.md and `docs/frontend/deployment.md` are at their final state.

Start with Stage 1, step A.
