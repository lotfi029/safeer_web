# safeer_web

Frontend for **جمعية سفير الدعوية**: Angular 22 (SSR, zoneless) + Tailwind 4 + Angular CDK.
Public site (server-rendered), student portal and admin dashboard (client-rendered). Arabic RTL by default, English LTR.

Project docs live in [`docs/`](docs/): start with `docs/safeer-frontend-session-1-prompt.md`,
`docs/safeer-frontend-sessions-plan.md` and `docs/safeer-frontend-plan.md`. Deployment: [`docs/frontend/deployment.md`](docs/frontend/deployment.md).

## Requirements

| | Version | Why |
|---|---|---|
| Build / CI | Node **24.21.0** (`.nvmrc`) | Angular CLI 22.2 needs Node ≥ 22.22.3 or ≥ 24.15 |
| Runtime (server) | Node 22.x or 24.x | `dist/safeer_web/server/server.mjs` is self-contained (verified on 22.22.2 and 24.21.0) |

## Setup

```bash
nvm use            # Node 24.21.0
npm ci
cp .env.example .env   # only needed to run the built server
```

## Commands

| Command | What it does |
|---|---|
| `npm start` | Dev server (`ng serve`, SSR + in-app mocks) on http://localhost:4200 — component kit at `/ar/_kit` |
| `npm run mock-api` | Node mock of `safeer_api` on :3100 (shared fixtures in `mocks/fixtures/`) |
| `npm run build` | Production build → `dist/safeer_web/` |
| `npm run build:ci` | Production build + gzip budget (< 150 KB) + prod-artifact check + `e2e` build |
| `npm run serve:ssr` | Run the built SSR server (reads `.env`) |
| `npm run lint` | `ng lint` (a11y rules = error) + `scripts/lint-styles.mjs` (logical properties, tokens) + Prettier |
| `npm run test:ci` | Angular unit tests (Vitest) |
| `npm run test:server` | Server/script unit tests (Vitest, node) |
| `npm run e2e` | Playwright + axe against the `e2e` build and the mock API (390/1440 × ar/en) |
| `npm run e2e:full` | Full matrix: 360/390/768/1024/1440/1920 × ar/en |

Locally, point Playwright at the pre-installed Chromium with `PW_CHROMIUM_PATH=/path/to/chrome`.
Set `E2E_SCREENS_DIR=docs/frontend/screens/phase-N` to write the committed 390/1440 screenshots.

## Environment

| Variable | Example | Purpose |
|---|---|---|
| `API_INTERNAL_URL` | `http://127.0.0.1:3000` | API origin on the internal network (SSR calls it directly; `/api/*` and `/files/*` are proxied to it) |
| `PUBLIC_SITE_URL` | `https://safeer-sa.org` | Public origin; its host + `www` are the only hosts SSR accepts in production |
| `PORT` | `4000` | SSR server port |
| `TRUST_PROXY` | `1` | Reverse-proxy hops in front of the server (client IP resolution) |

## CI

`.github/workflows/ci.yml` runs two jobs on every PR:

- **build-test**: lint → unit (app + server) → build + budgets → e2e against the mock API.
- **e2e-real** (W24): the same e2e suite against the real `safeer_api` at the `SAFEER_API_REF` repository variable
  (default `v1.0.0-rc1`) on MySQL 8 with the API's dev seed. Specs tagged `@mock-only` are dropped there (list them
  with `npx playwright test --list --grep @mock-only`; each carries its reason as an annotation).

The full 6 × 2 matrix runs against the mock in `nightly.yml`, on demand, and on PRs labelled `full-matrix`.

### Run e2e against the real API locally

With Docker and a built `safeer_api` checkout at the pinned ref next to this repo
(`git checkout v1.0.0-rc1 && npm ci && npm run build` there):

```bash
docker run -d --name safeer-e2e-db -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -e MYSQL_DATABASE=safeer -p 3307:3306 mysql:8.0
```

```bash
DB_PORT=3307 node scripts/real-api.mjs ../safeer_api --detach
```

```bash
npm run build:e2e && E2E_API_URL=http://127.0.0.1:3900 npx playwright test
```

`scripts/real-api.mjs` (also used by CI) migrates the database and boots the API on :3900 with `NODE_ENV=test`, the
API's own switch for skipping its per-IP rate limits (applications 5/h, OTP 5/h, contact 3/h, admin login 5/min).
Every e2e request reaches the API from one IP through the SSR proxy with parallel workers, so ordering specs can't
stay inside those budgets. Otherwise `test` behaves like `development` (dev seed, dev OTP hook). Rate limiting stays
covered by the API's own tests, and the site's 429 handling by the mock. Add `--no-migrate` to reuse the database;
stop the API with the pid it prints.

## Mocks

Backend features that are not live yet are implemented to the agreed contract in `mocks/backend.mjs`
(fixtures in `mocks/fixtures/`). The same code backs the in-app mock interceptor (`ng serve`,
`environment.useMocks`) and the Node mock API used by e2e/CI, so they cannot drift. Mock logins:
staff `admin@mock.invalid` / `mock-password` (also `reviewer@`, `editor@`, `support@`), applicant OTP `123456`.
Production builds contain no mock code and no `/_kit` (checked by `scripts/check-prod-artifact.mjs`).

The public fixtures (`site`, `home`, `board`, `workAreas`, `partners`, `documents`, `newsCategories`, `aboutItems`)
are recorded from a running API, so their shapes and copy can't drift from the real responses:
`node scripts/record-fixtures.mjs [--only board,site]` (boot the API first as above; each endpoint is fetched in
`ar` and `en` and merged into the `xAr`/`xEn` form the mock collapses). `posts`, `testimonials` and the staff/portal
fixtures stay hand-written: they hold drafts, preview tokens, quotes and accounts the dev seed doesn't have.
