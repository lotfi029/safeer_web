# Prompt — Session 2: Admin dashboard + launch (Phases 7–10)

> **Superseded:** use `docs/safeer-web-session-2-combined-prompt.md`, which runs this and the other half in one session.


> Start this only after **every Session 1 PR is merged into `main`** and `docs/frontend/HANDOFF.md` exists.
> Also start it only after the **Session 1 fix pass** (`docs/safeer-web-fix-prompt.md`, W1–W24) is merged, because it adds the real-API e2e job, the real role-matrix keys (W15) and the accept/reset pages (W16).
> If the backend contract changed since Session 1, refresh `docs/api/` first.
> Then run Claude Code on the `safeer_web` repo and paste everything below the line.

---

You are continuing **safeer_web**, the Angular 22 SSR frontend for **جمعية سفير الدعوية**. This is **Session 2 of 2**. Session 1 already delivered Phases 0–6: scaffold, foundations and UI kit, public site, news, apply flow and student portal. You deliver Phases **7–10**: the admin dashboard, then launch hardening and deployment.

## Read first, fully, in this order

1. `docs/frontend/HANDOFF.md` — **what exists and how to extend it.** Reuse the UI kit, API layer, stores, guards, mock framework and Playwright matrix helper it describes. Don't rebuild or fork them. If something you need is missing or broken, fix it in place and record it in your phase report.
2. `docs/safeer-frontend-sessions-plan.md` — the session split, rules, and Part A security decisions (CSP, caching, client IP). Keep them intact.
3. `docs/safeer-frontend-implementation-prompt.md` — stack, hard rules, per-phase notes for Phases 7–10.
4. `docs/safeer-frontend-plan.md` — §6.3 (admin screen → API map), §7 (cross-cutting), §8–9 (phases, backend prerequisites).
5. `docs/safeer-design-spec.md` §5 (dashboard screens, roles matrix) and `docs/safeer-prototype.html`. Screenshot every admin screen before building it.
6. `docs/api/`, or `safeer_api` directly if it's attached. The review/fix docs explain the B-items.

Before Phase 7, check the repo against the handoff:

- run the full test suite on `main`
- open `/_kit`
- confirm the listed mocks and live endpoints

Report any gaps in 5 lines or fewer, then start.

## Scope

- **Phase 7 — Admin core:**
  - admin shell: sidebar expanded ≥ xl, icon rail at lg, drawer < lg
  - login / forgot / reset / accept-invite
  - overview (role-aware KPIs + SVG chart)
  - applications list (status tabs with counts, filters, bulk bar, assign dialog, CSV export)
  - review screen (per-document accept/reject with reason, viewer dialog, notes, action log, transition buttons from the shared transition map + drift test)
  - messages (two-pane ≥ lg, list→detail on mobile)
  - The menu and route guards come from `GET /admin/roles` at runtime.
- **Phase 8 — Admin content:**
  - one config-driven `CrudList` + `CrudForm` (bilingual pairs side by side ≥ lg / tabs on mobile, reorder with drag-drop plus a keyboard move up/down, publish toggle, delete per role)
  - configured for work areas (+ items), board, testimonials (+ themes), partners, documents (+ categories), stats, about-items
  - hand-built: pages list + page-section editor with preview, news list + markdown editor with preview, legacy-news bulk delete
- **Phase 9 — Admin system:** users (invite, role, lock, roles matrix table), settings, mail and SMS (settings, templates, test send, logs), audit log, redirects, newsletter (+ CSV), interview slots, account (password, active sessions).
- **Phase 10 — Hardening:**
  - motion polish per spec
  - the full Playwright matrix: every screen (public + portal + admin) × 6 viewports × 2 locales, plus light/dark on the public shell
  - axe: zero serious/critical
  - Lighthouse CI (mobile) on home, news and article: A11y / BP / SEO ≥ 95, Perf ≥ 90
  - CSP re-verified on every route type
  - `docs/frontend/deployment.md` completed (Hostinger Node app, PM2, env vars, runtime Node version, API bound to localhost, `trust proxy`, backups)
  - final README

## Rules

- **Every phase must pass e2e against the real API** (the `e2e-real` CI job from the fix pass) as well as the mocks. Fixture-bound assertions are tagged `@mock-only`. Admin mock fixtures are recorded from real responses (`scripts/record-fixtures.mjs`), not hand-written.

- Admin screens are `RenderMode.Client`, `no-store` + `noindex`, and must be **fully usable on a 390px phone**, not just viewable:
  - tables become card lists
  - decision buttons sit in a sticky footer
  - bulk selection works through a selection mode
- Staff data access follows the role matrix exactly. Student documents and data appear only for `admin` and `reviewer`.
- Backend items not yet live (B7 assignees, B8 delete roles, B10 section count, B11 item visibility) are coded to contract and mocked. List active mocks in every report.
- One phase at a time on branch `feat/phase-N`, as a draft PR against `main`. Never merge, never force-push, never modify `safeer_api`.
- After each phase, report:
  - lint, unit, server tests, build + gzip budget, e2e/axe results
  - screenshots at 390 and 1440 in ar and en, saved to `docs/frontend/screens/phase-N/`
  - mocks and deviations

  Then **stop and wait for my OK**.

## Definition of done (end of Session 2)

- Every one of the 29 prototype screens (plus 404/500) has a working, API-backed counterpart. The final table covers public + portal + admin: screen → route → API calls → test file → status.
- CI green: lint, unit, server tests, build, gzip budget, the full e2e matrix, axe and Lighthouse.
- The whole site can be browsed in ar (RTL) and en (LTR) at 360 and 1440 with no layout breaks.
- `docs/frontend/HANDOFF.md` updated to the final as-built state, for future maintenance.

Start by reading the inputs and running the handoff check. Then plan Phase 7 briefly, execute it, and stop and report.
