# Review — Session 1 plan (safeer_web Phases 0–6)

**Date:** 2026-09-26 · **Verdict: approved with 12 changes (F1–F12).** The plan is thorough, applies R1–R11 correctly, puts the shared foundations Session 2 needs into Phase 1, and has real phase gates. Each change below was checked against the backend source (`safeer_api` @ `e934d8f`) or the published npm packages.

## Findings

### Must change

**F1 — The Signal Forms directive is `[formField]`, not `[field]`.** Verified in `@angular/forms@22.2.0` (`selector: '[formField]'`). Fix the `field` component contract and every template.

**F2 — Most "API snapshot gaps" are already answerable.** Use `docs/api/CONTRACT-NOTES.md` (new) as the source for the gaps it covers, and put in `contract-assumptions.md` only what those notes don't cover. The notes cover:
- cookie names, the CSRF header and where the token comes from
- the problem+json and zod `issues` format
- image variants, `sectionKey` values
- the `/testimonials`, `/portal/documents` and `interview-slots` shapes
- countries, `redirects/resolve`
- rate limits
- the nav slug→route map (`work` → `/work-areas`)

**F3 — Three real backend gaps the plan couldn't see.** They are now **B17–B19** in `docs/safeer-backend-fix-prompt.md`. Mock them to the shapes in the contract notes.
- **B17:** `GET /admin/roles` **does not exist**; the README documents it, but no controller implements it. Phase 1: `roleGuard` reads a mocked `/admin/roles` and keeps `core/auth/role-matrix.ts` as a typed fallback.
- **B18:** there's **no public source** for vision/mission/scholarship steps/requirements, and `about` and `scholarships` have no page sections. Only home goals and care pillars are exposed. Phase 3: About and Scholarships are built against a mocked `GET /about-items?kind=…`.
- **B19:** `GET /portal/documents` leaks `storageKey` and `checksum`. The response model types only the public fields, and nothing renders the rest.

**F4 — Autosave `null` rule is wrong.** "Empty → `null`" makes the strict PATCH schema return 400 for required fields.
- `null` is valid only for `middleName`, `idNumber`, `currentJob` and `scholarshipNote`.
- Other empty fields are **omitted**.
- Add a unit test for the payload builder.

**F5 — The offline draft stores personal data in `localStorage`.** The draft holds national ID, date of birth and phone, which is a risk on shared or university computers.
- Use `sessionStorage`, exclude `idNumber` and `birthDate`, and add a 24h TTL.
- Clear it on submit, logout and a 401.
- Say "saved on this device" in the UI.

**F6 — `/_kit` and the matrix helper conflict with the production e2e build.** e2e runs the production SSR build, where `/_kit` and the mock interceptor are removed. Fix:
- Add an `e2e` build configuration: production optimisations, CSP enforced, **plus** the kit route.
- A separate test asserts that the real `production` artifact has no `/_kit` and no mock code. Grep the bundle for the mock registry symbol.
- **Use one fixture source.** The in-app `mockBackendInterceptor` (for `ng serve`) and the Node e2e mock API both read `mocks/fixtures/*.json`, so the two can't drift.

### Should change

**F7 — Header breakpoint.** The prototype switches to the burger menu at **1100px**, not 1024. The Arabic nav has 10 items and overflows at 1024. Add a custom `nav: 1100px` breakpoint for the header only, and keep the plan's grid breakpoints for everything else.

**F8 — SSR failure mode.**
- Server-side HttpClient gets a **5s timeout**.
- If `/site` or the page's main call fails, render the 500/503 page with the right status (503 + `Retry-After: 30` when the API is unreachable). Never hang.
- Secondary sections (related news, testimonials) degrade to empty, not to an error page.

**F9 — Legacy-redirect lookups in `server.ts`.**
- Call `redirects/resolve` only for paths **outside** `/(ar|en)(/|$)`, `/api`, `/files` and static files.
- LRU-cache both hits and misses for 5 min.
- Cache `sitemap.xml` in memory for 10 min.

**F10 — CI cost and repo size.**
- Per-PR e2e: 390 + 1440 × ar/en, with axe. The full 6 × 2 matrix runs **nightly and before session exit** (a label or workflow_dispatch triggers it).
- Screenshots: viewport-only (not full page), compressed to ≤ **150 KB** each. Keep all of them as CI artifacts, and commit only `{screen}-{ar,en}-{390,1440}` into `docs/frontend/screens/`. Committing every run would add tens of MB of history per phase.

**F11 — `openapi-typescript@7.13` peers on `typescript ^5`, and the workspace runs TS 6.** Installing it as a devDependency fails with ERESOLVE. Run it as `npx -y openapi-typescript@7 …` inside `npm run api:types` and commit the generated file. Don't install it, and don't use `--legacy-peer-deps`.

**F12 — Small corrections.**
- **Image `srcset`:** all three variants always exist as WebP (`withoutEnlargement`). Build the width descriptors from `min(spec, widthPx)` and dedupe them.
- **Contact and newsletter `formRenderedAt`:** set it in the browser after hydration. The API **silently drops** a submit sent less than 3s later but still returns `ok`, so real-API e2e must wait more than 3s or backdate the value.
- **Runtime Node:** test `server.mjs` on 22.x and 24.x only. Node 20 is end-of-life, so drop the `/opt/node20` check unless Hostinger turns out to offer only that version.
- **Font preloads** don't need a nonce, because `font-src` governs them. JSON-LD `<script type="application/ld+json">` isn't executed, so its nonce is harmless but optional.
- **Countries:** API names are already localised. Sort them with `Intl.Collator(lang)`.

### Confirmed as planned

- R1–R11 are all applied.
- The phase gates are good.
- The prototype observations (no 404, dark or 390px screens; the portal's single OTP input) are handled the right way: follow the brief, derive from the spec, and report it.
- `[innerHTML]` is used only for the article body.
- The reload-safety test for B16 is included.
- The handoff contract matches the sessions plan.

## Paste-ready reply to the session

> Plan approved with these changes. Before Phase 0, read `docs/api/CONTRACT-NOTES.md` (new) and `docs/safeer-frontend-session-1-plan-review.md`, and apply F1–F12:
> - **F1:** the Signal Forms directive is `[formField]`.
> - **F2:** use CONTRACT-NOTES as the source for the gaps it covers. Only anything still unknown goes in `contract-assumptions.md`.
> - **F3:** mock **B17** `GET /admin/roles` (keep a typed fallback in `core/auth/role-matrix.ts`), **B18** `GET /about-items?kind=` for About and Scholarships, and **B19** by typing only the public document fields.
> - **F4:** autosave sends `null` only for `middleName`, `idNumber`, `currentJob` and `scholarshipNote`, and omits other empty fields. Add a unit test for this.
> - **F5:** the offline draft goes in `sessionStorage`, without `idNumber` or `birthDate`, with a 24h TTL. Clear it on submit, logout and 401.
> - **F6:** add an `e2e` build configuration (production + CSP + `/_kit`). Assert that the production artifact contains no `/_kit` and no mocks. Use one fixture set, `mocks/fixtures/*.json`, for both the interceptor and the Node mock API.
> - **F7:** the header burger switches at 1100px.
> - **F8:** SSR API timeout of 5s. Critical-call failure → 500, or 503 + `Retry-After` when the API is unreachable. Secondary sections degrade to empty.
> - **F9:** redirect lookups only outside `/(ar|en)`, `/api`, `/files` and static files, with an LRU cache of 5 min. Sitemap cached for 10 min.
> - **F10:** PR e2e covers 390/1440 × ar/en. The full matrix runs nightly and before session exit. Screenshots are viewport-only, ≤150 KB, and only `{screen}-{ar,en}-{390,1440}` are committed.
> - **F11:** run `openapi-typescript` via `npx` and don't install it.
> - **F12:**
>   - `srcset` widths use `min(spec, widthPx)`, deduped.
>   - `formRenderedAt` is set in the browser, and real-API e2e waits more than 3s.
>   - Runtime Node check covers 22/24 only.
>   - Font preloads need no nonce.
>   - Countries are sorted with `Intl.Collator`.
>
> Then start Phase 0.
