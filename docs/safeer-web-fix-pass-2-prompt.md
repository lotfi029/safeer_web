# Prompt — safeer_web: finish the Session 1 fix pass (part 2)

> **Superseded:** use `docs/safeer-web-session-2-combined-prompt.md`, which runs this and the other half in one session.


> The backend ref is `v1.0.0-rc1`, and the repo variable `SAFEER_API_REF` is already set.
> Run Claude Code on `safeer_web` (attach `safeer_api` too if you can) and paste everything below the line.

---

You are continuing the Session 1 fix pass on **safeer_web**, branch `fix/session-1-review`, with its existing draft PR. Keep working on that branch and PR.

## Read first
1. `docs/safeer-web-fix-pass-2-plan.md`. It has the status of every W-item on this branch as independently verified, and the plan (steps A–F) you must follow.
2. `docs/safeer-delivery-review.md` §4: the definition of each W-item (W1–W24).
3. `docs/safeer-web-fix-prompt.md`: the rules still apply.
4. `docs/frontend/HANDOFF.md` and `docs/api/` (the rc1 snapshot, including `CONTRACT-NOTES.md`).

## What the previous run did (don't redo it)
W2, W3, W12, W15, W17 and W23 are done, and the whole `API-CHANGES.md` contract, A1–A12 included, was adopted in `cf40539` (draft PR #9). Keep the test-only mock route `POST /__site`. Also carry forward your own open note: card leads that strip section HTML to plain text should use a shared, tested plain-text helper; fold it into step C. The branch is green against mocks: 174/174 e2e, 170 unit, 53 server tests, gzip 136.1 KB.

## What went wrong, and the rule that fixes it
Against the real API, the branch still fails **20 e2e specs**: 13 `en @1440` header overflows (W5), 4 board (W1), and 3 fixture-bound. The previous run skipped W24, so nothing surfaced these failures.

**From now on, nothing counts as fixed until it passes e2e against the real API.** Build that job first.

## Do this, in order (details in the plan, §3)
- **A. W24:** add the `e2e-real` CI job (MySQL 8 service, `safeer_api` at `vars.SAFEER_API_REF` with a default of `v1.0.0-rc1`, migrate, boot, Playwright with `E2E_API_URL`). Tag the fixture-bound specs `@mock-only`. Handle the API rate limits: pick one of spec ordering or the API's `NODE_ENV=test` throttle opt-in, and justify the choice. Add the local 3-command recipe to the README. **Then stop and report the real-API failure list.**
- **B.** W1, W4, W5 (plus `scripts/record-fixtures.mjs`, so fixtures come from real responses).
- **C.** W6, W7, W8.
- **D.** W9, W10, W11, W13, W14.
- **E.** W16 (working accept and reset pages, needed for Session 2).
- **F.** W18, W19, W20, W21, then W22 (HANDOFF.md) last.

After A is reported and I approve, continue B→F without stopping, unless something is blocked or a decision is needed.

## Rules
- Hard rules from `docs/safeer-frontend-implementation-prompt.md` and R1–R11 in `docs/safeer-frontend-sessions-plan.md` still apply. Don't regress CSP (including the new `frame-src`), the proxy, SSR status codes, or accessibility.
- One commit per group (A–F). No merge, no force-push, and never modify `safeer_api`.
- **Gate before the final report:**
  - `npm run lint`, `test:ci`, `test:server`, `build:ci`
  - e2e against **mocks and the real API**, both green
  - screenshots at 390 and 1440 in ar and en of the board, home, the English header, contact and apply, into `docs/frontend/screens/session-1-fixes/`
- **Final report:**
  - a table of W1–W24 → fix → commit → test (mark the ones done in the earlier run as such)
  - the `@mock-only` list, with why each can't run against the real API
  - anything Session 2 must know that isn't in HANDOFF.md

Start with step A.
