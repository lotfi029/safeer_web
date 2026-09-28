# CLAUDE.md — safeer_web

Frontend for جمعية سفير الدعوية: Angular 22 (SSR, zoneless) + Tailwind 4 + Angular CDK. Public site (SSR), student portal and admin dashboard (CSR). Arabic RTL default, English LTR.

## Read first
- `docs/safeer-web-session-2-combined-prompt.md` — **the task brief** (start here), with `docs/safeer-web-session-2-combined-plan.md` (phases and gates)
- `docs/frontend/HANDOFF.md` — the as-built state: what exists, conventions, test counts, open items, backend follow-ups
- `docs/safeer-frontend-plan.md` — architecture, routes, responsive rules, screen→API map
- `docs/safeer-design-spec.md` — exact design tokens and screen list
- `docs/safeer-prototype.html` — clickable prototype (open with Playwright and screenshot before building a screen)
- `docs/brand/safeer-logo-official.svg` — the official logo (full lockup). App assets are derived from it by `node scripts/build-brand.mjs`; never trace or redraw it. `docs/safeer-logo.png` was the stand-in
- `docs/api/` — API contract snapshot from `safeer_api` @ `v1.0.0-rc1` (`e86b3b5`, = the `SAFEER_API_REF` repo variable): `CONTRACT-NOTES.md` (start here), `API-CHANGES.md`, `openapi.json` (requests) + `src/**` (mappers, DTOs, controllers, response-building services). Refresh with `node scripts/snapshot-api.mjs ../safeer_api <ref>`
- `docs/safeer-backend-fr-review.md`, `docs/safeer-backend-fix-prompt.md` — backend gaps/prerequisites (B-numbers), fixed in the `safeer_api` repo, not here

## Rules
- Keep `docs/` committed. Never overwrite it when scaffolding (`ng new … --directory .`).
- Don't modify the backend from this repo. In `../safeer_api` run nothing except `node scripts/real-api.mjs` (from this repo) and read-only reads (files, `git show`/`git log`). Report any accidental write there immediately.
- Real-API e2e required; no mocks by default; list any exception. Every spec runs against the mock and the real API (`E2E_API_URL`, seeded with `e2e/support/real-db.ts`); `mockOnly(reason)` is only for data the API can't produce, and each one is listed with its reason in the phase report and HANDOFF.
- Every screen must work at 360/390/768/1024/1440/1920 in ar (RTL) and en (LTR). CSS logical properties only.
- No invented content. Use `[...]` placeholders.
- Work on a branch per phase and open a draft PR. Never merge, never force-push.
