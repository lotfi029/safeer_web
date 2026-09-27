# CLAUDE.md — safeer_web

Frontend for جمعية سفير الدعوية: Angular 22 (SSR, zoneless) + Tailwind 4 + Angular CDK. Public site (SSR), student portal and admin dashboard (CSR). Arabic RTL default, English LTR.

## Read first
- `docs/safeer-frontend-implementation-prompt.md` — **the task brief** (start here)
- `docs/safeer-frontend-plan.md` — architecture, routes, responsive rules, screen→API map, phases
- `docs/safeer-design-spec.md` — exact design tokens and screen list
- `docs/safeer-prototype.html` — clickable prototype (open with Playwright and screenshot before building a screen)
- `docs/safeer-logo.png` — temporary logo (the official SVG is pending)
- `docs/api/` — API contract snapshot from `safeer_api` @ `v1.0.0-rc1` (`e86b3b5`, = the `SAFEER_API_REF` repo variable): `CONTRACT-NOTES.md` (start here), `API-CHANGES.md`, `openapi.json` (requests) + `src/**` (mappers, DTOs, controllers). Refresh with `node scripts/snapshot-api.mjs ../safeer_api <ref>`
- `docs/safeer-backend-fr-review.md`, `docs/safeer-backend-fix-prompt.md` — backend gaps/prerequisites (B-numbers), fixed in the `safeer_api` repo, not here

## Rules
- Keep `docs/` committed. Never overwrite it when scaffolding (`ng new … --directory .`).
- Don't modify the backend from this repo. Mock missing backend features behind `environment.useMocks`.
- Every screen must work at 360/390/768/1024/1440/1920 in ar (RTL) and en (LTR). CSS logical properties only.
- No invented content. Use `[...]` placeholders.
- Work on a branch per phase and open a PR. Never force-push `main`.
