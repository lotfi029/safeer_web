# Prompt — safeer_web Stage 2 kickoff (Phases 7–10)

> **Before pasting:**
> 1. Merge PR #9 into `main`.
> 2. Commit and push the `docs/` files, including `safeer-web-session-2-combined-plan.md`, which now has a "Stage 1 result" section.
>
> **If the combined session is still open:** paste only the part below the line as your reply.
> **If you start a new session:** paste `docs/safeer-web-session-2-combined-prompt.md` first, then this.

---

Stage 1 is approved. I re-ran PR #9 independently against the real API:
- lint, unit **190**, server **62**
- `build:ci` 136.5 KB
- e2e **195/195** against mocks and **141/141** against the real API

PR #9 is merged. Start **Stage 2** from the updated `main`: one branch and draft PR per phase, following `docs/safeer-web-session-2-combined-plan.md` Stage 2, plus the "Stage 1 result → carried into Stage 2" list.

Apply these before and during Phase 7:

1. **Real-API test support first, on branch `feat/phase-7`, in its first commit.** Add `e2e/support/real-db.ts`. It's active only when `E2E_API_URL` is set, connecting with mysql2 to the same e2e database `scripts/real-api.mjs` migrates, with argon2 using the API's `ARGON2_OPTIONS`. It provides:
   - `seedStaff(role, {status})`: a temp staff user with a known password for each role (admin, reviewer, editor, support), plus a disabled or locked variant.
   - `insertAuthToken(userId, purpose)`: a raw token plus its hash, stored the way the API stores it, for accept and reset.
   - Cleanup in `afterAll`.

   Wire it into CI's `e2e-real` job (it already has the MySQL service). Every admin spec in Phases 7–9 then runs against both the mock and the real API. **An admin spec may be `@mock-only` only when it needs data the API can't produce**, and it must be listed with the reason.
2. **Student portal on the real API.** Remove the portal's file-level `@mock-only`. Specs create an application through the UI or API, request an OTP, read it from `GET /__dev/otp/:applicationId` (the API runs with `NODE_ENV=test`), then verify. Cover:
   - status and timeline
   - documents: upload, and replacing a rejected document (the rejection is set up through the admin API with a seeded reviewer)
   - interview book/cancel, using a slot created by a seeded admin
   - reload-then-write (the CSRF token after a reload)
3. **Contact and newsletter submits on the real API.** Wait more than 3 s after the form renders (or use Playwright's clock) so the API's too-fast check doesn't silently drop them. Then assert on the real inbox and subscriber rows through the admin API.
4. **Reduce `@mock-only`.** Report the count before and after Phase 7. Only the following stay mock-only:
   - fixture content the seed lacks
   - `__echo`/`__log`/`__site`
   - the accept/reset success path, *only if* `insertAuthToken` somehow can't cover it (it should)
5. **`CLAUDE.md`:** make the entry point `docs/safeer-web-session-2-combined-prompt.md`. Replace "mock missing backend features" with "real-API e2e required; no mocks by default; list any exception". Point to `HANDOFF.md`.
6. **Scope rule:** never run commands inside `../safeer_api` except `scripts/real-api.mjs` and read-only reads. After the step-A incident, report any accidental write immediately.
7. **Housekeeping:** stop the local scratch stack (the API on :3900 and the `safeer-e2e-db` container on :3307) after each phase's gate, unless the next phase starts right away.

Then Phase 7 as planned:
- the admin shell
- auth: login and forgot; reset and accept are already built (W16), so reuse them
- overview
- applications list and review
- messages

Guards come from `GET /admin/roles`, with the `downloadPath` rule for document links. The Phase 7 gate: lint, unit, server, `build:ci`, e2e against the mock **and** the real API, screenshots at 390 and 1440 in ar and en in `docs/frontend/screens/phase-7/`, and the `@mock-only` count. **Then stop and report.**
