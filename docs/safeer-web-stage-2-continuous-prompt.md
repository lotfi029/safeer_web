# Prompt — safeer_web Stage 2: Phase 7 plan approved with corrections, then run Phases 7 → 10 without stopping

> Paste everything below the line into the `safeer_web` Claude Code session, as the reply to its Phase 7 plan.

---

Your Phase 7 plan is **approved with the corrections below**. **Change of process:** don't stop after Phase 7. Run **Phases 7, 8, 9 and 10 back to back** until the whole Stage 2 plan (`docs/safeer-web-session-2-combined-plan.md`) is finished. Only stop for the conditions under "When you may stop".

## Corrections to the Phase 7 plan (checked against the rc1 schema and code)

1. **`users.id` is `BIGINT UNSIGNED AUTO_INCREMENT`, not a UUID.** `seedStaff` must `INSERT` without an id and read `insertId`. `users` also requires **`name`** (`VARCHAR(120) NOT NULL`); use `E2E <role> <rand>`. The rc1 columns are:
   - `status` (`active|disabled|invited`)
   - `failed_logins`, `last_failed_login_at`
   - `locked_until`, `lock_count`

   There is **no `is_locked`** column any more: it was replaced in migration 008. A locked user is `locked_until = UTC_TIMESTAMP(3) + INTERVAL 1 HOUR`, `lock_count = 1`. Set every datetime with `UTC_TIMESTAMP(3)` in SQL, never a JS local time, because the API enforces UTC.
2. **Tokens:** `auth_tokens(user_id, purpose ENUM('invite','reset'), token_hash CHAR(64), expires_at, used_at)`. The hash is `sha256(rawToken).hex`, and the raw token is `randomBytes(32).toString('base64url')`. Your plan matches this; keep it. Deleting a user cascades to its tokens and sessions. The other foreign keys to `users` are `SET NULL`, so cleanup after a spec that wrote notes, events or replies is safe.
3. **Login errors don't differ by account state.** The API deliberately returns the **same 401 `UNAUTHENTICATED` "Invalid email or password"** for a wrong password, an unknown email, a disabled account and a locked account (non-enumeration, A2/C3), and 429 `RATE_LIMITED` for the per-email limiter. **Don't build disabled, locked or `lockedUntil` messages into the login screen.** The e2e test asserts that a disabled user and a locked user each get **exactly the same message** as a wrong password, and that the correct password works again once `locked_until` has passed. Show the disabled and locked state on the Phase 9 users screen instead.
4. **The fast-submit check in `page.clock` works backwards from how the plan uses it.** The API compares **its own clock** with the browser's `formRenderedAt`. Fast-forwarding the browser clock after render doesn't move the server clock, so the submit is still dropped. Choose one:
   - Call `page.clock.install({ time: Date.now() - 5000 })` **before** `goto`, so the form's timestamp is already 5 s old.
   - Or wait 3.1 s of real time.

   Assert on the real message or subscriber row through the admin API either way. A silent drop still returns `{ ok: true }`, so the response alone proves nothing.
5. **Endpoints exist in rc1, so don't mark them mock-only:** `GET/POST/PATCH/DELETE /admin/interview-slots` and `GET /admin/newsletter` (+ `/export.csv`). Portal interview booking and cancelling, and the newsletter assertions, run against the real API.
6. **Convert-to-testimonial goes in Phase 7, not 8.** The spec's messages screen includes reply, archive **and convert to testimonial** (`POST /admin/messages/:id/convert-to-testimonial`), so build it with the inbox.
7. **Seeded email domain:** keep `@e2e.invalid`, and also set `name` so the admin screens have something real to render. Name sweep uses `email LIKE '%@e2e.invalid'` only. Never match on role or name.
8. Everything else in your plan stands:
   - `real-db.ts` loads mysql2 and argon2 from the API's `node_modules`, and has the `ARGON2_OPTIONS` drift test
   - the portal on the real API through `__dev/otp`
   - the transitions drift test
   - `downloadPath` handling
   - role coverage
   - `record-fixtures.mjs` for the admin fixtures
   - `CLAUDE.md` update

## Running Phases 7 → 10 without stopping

**Branches and PRs:**
- `feat/phase-7` starts from `main`, `feat/phase-8` from `feat/phase-7`, and so on: **stacked**.
- Each phase gets its own draft PR whose base is the previous phase's branch (Phase 7's base is `main`), so each PR shows only that phase's diff.
- Never merge, never force-push.

**For each phase, in order:**
1. Plan the phase **briefly in the PR description**, not as a stop point. Build it following the combined plan's Stage 2 table.
   - **Phase 8:** content CRUD kit + pages/news editors + media.
   - **Phase 9:** system screens, including users with `status`/unlock, settings with map fields, mail/SMS, audit, redirects, newsletter, interview slots, account, and application anonymise.
   - **Phase 10:** hardening, the full matrix, axe, Lighthouse, CSP, deployment docs.
2. Run the **full gate**:
   - lint, unit, server, `build:ci` (report the gzip size)
   - e2e against the mock **and** the real API, both green
   - screenshots at 390 and 1440 in ar and en in `docs/frontend/screens/phase-N/`
   - the `@mock-only` count
3. Update `docs/frontend/HANDOFF.md` to the as-built state, so a fresh session could resume from it.
4. Commit, push, open or update the draft PR. **The PR description is the phase report:**
   - what was built
   - gate numbers
   - the `@mock-only` list with reasons
   - any mocked endpoint (expected: none) and its reason
   - deviations
5. Start the next phase straight away. Stop the scratch stack only at the very end, or while it isn't needed.

**Rules that still apply in every phase:**
- **Nothing counts as done until it's green against both the mock and the real API.**
- Admin screens are `RenderMode.Client`, `no-store` + `noindex`, and fully usable at 390px.
- Access follows `GET /admin/roles`, with `*.delete` controlling delete actions.
- Never modify `../safeer_api`. Run only `scripts/real-api.mjs` there, plus read-only reads.
- No invented content.

## When you may stop

Stop only for one of these. When you do, say exactly what you need from me.

- **A backend bug or missing endpoint that blocks a screen.**
  - Don't change `safeer_api`.
  - If the screen can still ship, mock that one call with a written reason, record it in HANDOFF.md under "backend follow-ups", and **continue**.
  - Stop only if the screen can't work at all.
- **A product decision the spec, the prototype and the plan don't answer,** where guessing would be expensive to undo. Otherwise pick the option closest to the spec, note it in the PR, and continue.
- **Anything destructive or outside the repo:** credentials, production, or deleting things you didn't create.
- **Context running out.** First make sure HANDOFF.md plus the latest PR description let a fresh session resume at the exact next step. Then stop and say where to resume.

## Final report (only at the end of Phase 10)

- The four PR links.
- The final gate numbers against both the mock and the real API.
- The **screen coverage table:** all 29 prototype screens plus 404/500 → route → API calls → test file → status.
- The remaining `@mock-only` list with reasons.
- Backend follow-ups found, if any.
- Lighthouse scores for home, news and article.
- The deployment doc path.
- Anything still owed by the client: logo SVG, photos, impact numbers, partners, domain, SMS account.

Start Phase 7 now, with the corrections above.
