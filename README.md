# safeer_web

Frontend for **جمعية سفير الدعوية**: Angular 22 (SSR, zoneless) + Tailwind 4 + Angular CDK.
There are three parts:
- **Public site**: server-rendered.
- **Student portal** and **admin dashboard**: client-rendered, `no-store`, `noindex`.

Arabic RTL is the default; English is LTR. The backend is [`safeer_api`](https://github.com/lotfi029/safeer_api), and
this frontend targets `v1.0.0-rc1` (contract snapshot in [`docs/api/`](docs/api/)).

| Doc | What |
|---|---|
| [`docs/frontend/HANDOFF.md`](docs/frontend/HANDOFF.md) | **The as-built state**: routes, conventions, screen coverage, test totals, open items, backend follow-ups |
| [`docs/frontend/deployment.md`](docs/frontend/deployment.md) | Hostinger runbook: topology, env, PM2/`app.cjs`, verification, backups |
| [`docs/safeer-frontend-plan.md`](docs/safeer-frontend-plan.md), [`docs/safeer-design-spec.md`](docs/safeer-design-spec.md) | Architecture, responsive rules, design tokens, screen list |
| [`docs/safeer-prototype.html`](docs/safeer-prototype.html) | The clickable prototype the screens follow |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for this repo |

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
| `npm start` | Dev server (`ng serve`, SSR + in-app mocks) on http://localhost:4200; the component kit is at `/ar/_kit` |
| `npm run mock-api` | Node mock of `safeer_api` on :3100 (fixtures in `mocks/fixtures/`) |
| `npm run build` | Production build → `dist/safeer_web/` |
| `npm run build:ci` | Production build + gzip budget (< 150 KB initial) + prod-artifact check + `e2e` build |
| `npm run serve:ssr` | Run the built SSR server (reads `.env`) |
| `npm run lint` | `ng lint` (a11y rules = error) + `scripts/lint-styles.mjs` (logical properties, tokens) + Prettier |
| `npm run test:ci` | Angular unit tests (Vitest) |
| `npm run test:server` | Server, script, mock and drift tests (Vitest, node) |
| `npm run e2e` | Playwright + axe against the `e2e` build and the mock API: 390/1440 × ar/en, plus dark mode at 1440 |
| `npm run e2e:full` | Full matrix: 360/390/768/1024/1440/1920 × ar/en, each in light and dark |
| `npm run lighthouse` | Lighthouse (mobile) on home, news and an article, from the production build (`npm run build` first) |

Locally, point Playwright at an installed Chromium with `PW_CHROMIUM_PATH=/path/to/chrome`.
Set `E2E_SCREENS_DIR=docs/frontend/screens/phase-N` to write the committed 390/1440 screenshots.

## Environment

| Variable | Example | Purpose |
|---|---|---|
| `API_INTERNAL_URL` | `http://127.0.0.1:3900` | API origin on loopback. SSR calls it directly; `/api/*` and `/files/*` are proxied to it |
| `PUBLIC_SITE_URL` | `https://<domain>` | Public origin. Its host and `www.` are the only hosts SSR accepts in production |
| `PORT` | `4000` | SSR server port |
| `TRUST_PROXY` | `1` | Reverse-proxy hops in front of the server (client IP resolution) |

See [`docs/frontend/deployment.md`](docs/frontend/deployment.md) §4 for the values that must match the API's.

## CI

`.github/workflows/ci.yml` runs on every PR, on `main`, and nightly.

| Job | What |
|---|---|
| **build-test** | lint → unit (app + server) → build + budgets → e2e against the mock API |
| **e2e-real** | The same e2e suite against the real `safeer_api` at the `SAFEER_API_REF` repository variable (default `v1.0.0-rc1`), on MySQL 8 with the API's dev seed. `e2e/support/real-db.ts` seeds per-role staff and auth tokens |
| **lighthouse** | `npm run lighthouse`, median of 7 runs. Performance ≥ 90; Accessibility, Best practices and SEO ≥ 95 |

The full matrix (6 viewports × 2 locales × light/dark) runs on both backends nightly, and on PRs labelled
`full-matrix`.

Every spec runs on both backends. The few tagged `@mock-only` need data only the mock can set up; each carries its
reason. List them with `npx playwright test --list --grep @mock-only`.

### Run e2e against the real API locally

You need Docker and a built `safeer_api` checkout at the pinned ref next to this repo
(`git checkout v1.0.0-rc1 && npm ci && npm run build` there):

```bash
docker run -d --name safeer-e2e-db -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -e MYSQL_DATABASE=safeer -p 3307:3306 mysql:8.0
```

```bash
DB_PORT=3307 node scripts/real-api.mjs ../safeer_api --detach
```

```bash
npm run build:e2e && E2E_API_URL=http://127.0.0.1:3900 DB_PORT=3307 npx playwright test
```

`scripts/real-api.mjs` (also used by CI) migrates the database and boots the API on :3900 with `NODE_ENV=test`.
That is the API's own switch for skipping its per-IP rate limits: every e2e request reaches the API from one IP
through the SSR proxy, with parallel workers, so ordering specs can't keep them inside the limits. Otherwise `test`
behaves like `development` (dev seed, dev OTP hook). The per-email login limiter stays on, and the e2e covers it.

Add `--no-migrate` to reuse the database, and stop the API with the pid it prints. Seeded staff use
`@e2e.invalid` emails and are swept after each run.

## Mocks

`mocks/backend.mjs` (plus `admin*.mjs`) implements the API contract. The same code backs two things, so they can't
drift:
- the in-app mock interceptor (`ng serve`, `environment.useMocks`)
- the Node mock API that e2e uses

Mock logins:
- staff: `admin@mock.invalid` / `mock-password` (also `reviewer@`, `editor@`, `support@`)
- applicant OTP: `123456`

Production builds contain no mock code and no `/_kit`; `scripts/check-prod-artifact.mjs` checks this.

Fixtures are recorded from a running rc1 API, so shapes and copy can't drift:
- **Public:** `node scripts/record-fixtures.mjs [--only board,site]`
- **Admin:** `node scripts/record-admin-shapes.mjs [--content]`. `mocks/admin-shapes.test.mjs` checks every mock
  response against the recorded shapes.

`posts`, `testimonials` and the portal fixtures stay hand-written, because they hold drafts, preview tokens and quotes
the dev seed doesn't have.
