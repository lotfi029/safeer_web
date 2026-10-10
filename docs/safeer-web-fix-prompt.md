# Prompt — safeer_web: Session 1 fix pass (W1–W24), before Session 2

> Run Claude Code on the `safeer_web` repo and paste everything below the line. Run it **before** `docs/safeer-frontend-session-2-prompt.md`. If you can, attach `safeer_api` to the session as a second repo.

---

You are fixing **safeer_web** (Angular 22.2 SSR, zoneless; Session 1 delivered the public site, apply flow and student portal). A delivery review ran the production build **against the real backend** and found that pages which pass against the mocks break against the real API, along with UX, security and performance issues. Fix all of them before Session 2 (the admin dashboard) starts.

## Read first

1. `docs/safeer-delivery-review.md`, §4: items **W1–W24**, with evidence and the fix for each. This is your task list.
2. `docs/frontend/HANDOFF.md`: current architecture and conventions. Keep them.
3. The real backend contract.
   - If `safeer_api` is attached, read its source directly, plus its `docs/backend/API-CHANGES.md`.
   - Otherwise, re-snapshot first (W23): copy `openapi.json`, the `src/**/public-*.ts` mappers and the portal/newsletter DTOs from `lotfi029/safeer_api@main` into `docs/api/`, and rewrite `docs/api/CONTRACT-NOTES.md` so it describes the **current** API, without "mocked"/"planned" labels for things that are live.

## Test against the real API (W24, do this first)

1. Add a CI job `e2e-real`:
   - Check out `lotfi029/safeer_api` at a pinned SHA (a repo variable, `SAFEER_API_REF`) and start MySQL 8 as a service.
   - In the API: `npm ci && npm run build && npm run migrate` with the same env as the API's own CI (`NODE_ENV=development`, `FRONTEND_BASE_URL` = the SSR URL, the bootstrap admin). Then boot it.
   - Run Playwright with `E2E_API_URL` pointed at it.
2. Split the specs.
   - Assertions tied to fixture data (exact partner names, `/files/doc-*` ids, fixture counts) go into `test.describe` blocks tagged `@mock-only`, which the real-API job skips.
   - Every other assertion must pass on **both** jobs.
3. The API rate-limits per IP: 5 applications/h, OTP 5/h, contact 3/h.
   - Order the real-API specs so they stay under these limits, or run the API with a test-only env that raises them if the backend offers one. Check the API source; don't add backend changes from here.
4. Local reproduction: document it in `README.md` in 3 commands (API up, `E2E_API_URL=… npx playwright test`).

## Then fix, in this order

1. **Real-API blockers:** W1 (board shape), W2 (paged notifications + event types), W3 (newsletter `{email, token}`), W4 (one current document per type; no client-side delete).
   - Fix the matching mock fixtures **from the real responses**. Where possible, generate fixtures by recording real responses, via a small `scripts/record-fixtures.mjs` that hits the running API. Hand-edit only where the data must be synthetic.
2. **Header and UX:** W5–W8.
   - W5: the header must never overflow at any width from 360 to 1920 in either language, with real data. Use short nav labels: a frontend `navLabel` map keyed by slug (`home, about, board, work, scholarships, news, testimonials, partners, documents, contact`) in both languages, falling back to the API title. Add e2e overflow checks at 1100, 1280 and 1440 on the real API.
3. **Security, correctness and performance:** W9–W14. W9 needs an e2e assertion that no `/api/v1` request happens after hydration on `/ar`, `/en/news` and an article.
4. **Session 2 prerequisites:**
   - **W15:** adopt the real `GET /admin/roles` area keys everywhere: fixture, `role-matrix.ts`, `roleGuard`, route data.
   - **W16:** add `/:lang/admin/accept/:token` and `/:lang/admin/reset/:token`. Working pages are fine: they need only the public `POST admin/auth/accept/:token` and `POST admin/auth/reset/:token` plus the UI kit. Build them now, not in Session 2.
5. **Low items:** W17–W21.
6. **Docs:** W22 (HANDOFF.md), then W23 if it wasn't done at the start.

## Rules

- Everything in `docs/safeer-frontend-implementation-prompt.md` (hard rules) and `docs/safeer-frontend-sessions-plan.md` (R1–R11) still applies. Don't regress CSP, proxy, SSR or accessibility behaviour.
- Work on branch `fix/session-1-review`, as one draft PR against `main`, with one commit per group above. Never merge, never force-push, never modify `safeer_api`.
- Gate before reporting:
  - `npm run lint`
  - `npm run test:ci`
  - `npm run test:server`
  - `npm run build:ci` (gzip budget)
  - Playwright against the **mock and the real API**, both green
  - screenshots of the fixed screens at 390 and 1440 in ar and en, into `docs/frontend/screens/session-1-fixes/`
- Final report: a table of W-item → fix → commit → test, plus the list of `@mock-only` specs with why each can't run against the real API.

Start with W24 and W23 (real-API CI + contract snapshot), then report the real-API failure list before fixing anything else.
