# safeer_api contract notes (verified from source @ e934d8f)

These notes answer the "API snapshot gaps" from the Session 1 plan. They were read from the backend source, not assumed. Anything marked **B-nn** doesn't exist yet: mock it to the shape given here.

## Transport
- Base: `/api/v1`. Files: `/files/:publicId` (original) and `/files/:publicId/:variant`, both **outside** `/api/v1`.
- Image variants: `thumb` 400, `card` 800, `full` 1600. All are **WebP**, generated with `withoutEnlargement`. For small originals the real widths collapse, so build `srcset` descriptors from `min(specWidth, asset.widthPx)` and dedupe. `widthPx`/`heightPx` on the asset belong to the original.
- **Locale:** `?lang=ar|en` → `Accept-Language` → `ar`. Public responses collapse every `xAr`/`xEn` pair into `x`, falling back to Arabic when English is empty. `/admin/*` responses keep both raw fields.
- **Cookies** (HttpOnly, SameSite=**Strict**, path `/`, Secure in production):
  - staff `sf_sid`
  - applicant `sf_app_sid`

  Strict means the first navigation in from an external link (e.g. an email) carries no cookie. That's fine, because admin and portal are CSR and their first API fetch is same-site.
- **CSRF:** header `X-CSRF-Token` on non-GET requests that carry a session. The token comes in the **response body** of:
  - `POST /admin/auth/login`
  - `GET /admin/me`
  - `POST /applications`
  - `POST /portal/auth/verify-otp`
  - `GET /portal/me` (only after **B16**)

  Public writes (`/contact`, `/newsletter`, `POST /applications`, OTP request/verify) need no token.

## Errors (`application/problem+json`)
```
{ type: "https://safeer-sa.org/errors/<kebab-code>", title, status, code, requestId, ...extra }
```
- Validation: `code: "VALIDATION_FAILED"`, `extra.issues` = zod v4 issues `[{ path: (string|number)[], message, code }]`. Map `path[0]` to the form field.
- `DOCUMENTS_INCOMPLETE` → `extra.missing: DocType[]`. `INVALID_STATUS_TRANSITION` → `extra.{from,to}`.
- Codes: `VALIDATION_FAILED UNAUTHENTICATED FORBIDDEN NOT_FOUND ASSET_IN_USE RESOURCE_IN_USE ALT_TEXT_REQUIRED LAST_ADMIN SLUG_TAKEN PUBLISH_BLOCKED RATE_LIMITED UNSUPPORTED_PROVIDER SOURCE_TYPE_MISMATCH UNKNOWN_VARIABLE FEATURE_DISABLED NOT_IMPLEMENTED APPLICATION_LOCKED OTP_INVALID DOCUMENTS_INCOMPLETE SLOT_ALREADY_BOOKED INTERVIEW_NOT_AVAILABLE INVALID_STATUS_TRANSITION`, plus the fallbacks `CONFLICT INTERNAL_ERROR`. Planned codes: `APPLICATION_EXISTS` (B2), `INVALID_ASSIGNEE` (B7).
- **Rate limits** (429 `RATE_LIMITED`):
  - `/contact`: 3/h per IP
  - `/newsletter`: 5/h
  - `POST /applications`: 5/h
  - `request-otp`: 5/h per IP + 5/15 min per identifier
  - `verify-otp`: 10/h
  - global: 100/min

## Public endpoints
- `GET /site` → `{ settings, nav: [{ slug, title… }], contact: { phone, email, address } }`.
  - `nav` slugs, fixed order: `home about board work scholarships news testimonials partners documents contact`.
  - **Slug ≠ route:** map `work` → `/:lang/work-areas` and `home` → `/:lang`.
- `GET /home` → `{ settings, sections[], aboutItems: { goals[], carePillars[] }, stats[], workAreas[] (with items), news[3], testimonials[2], partners[] }`.
  - `sectionKey` values in seed order: `hero about impact work_areas student_care news testimonials partners cta`.
  - `partners` is seeded **unpublished**. A `null` stat value means "show `[—]`".
- `GET /pages/:slug` → page meta + published sections.
  - Seeded slugs: `home about board work scholarships news article testimonials partners documents contact`.
  - **Only `home` has sections.** `about` and `scholarships` content needs **B18**.
- **B18 (mock):** `GET /about-items?kind=vision,mission,goal,care_pillar,scholarship_step,requirement` → `{ [kind]: [{ id, icon, title, body, sortOrder }] }`.
- `GET /testimonials` → `{ featured[], list[], themes[] }`.
- `GET /board`, `/work-areas`, `/partners?category=`, `/documents`: see `src/**/public-*.ts`. The board bio is **B12**.
- `GET /news?category=&q=&page=&limit=` → `{ data, total, page, limit }`. Also `GET /news/featured`, `GET /news-categories`.
- `GET /news/:slug` → post + `related[]`. `body` is sanitized HTML. `?preview=<token>` shows unpublished posts.
- `GET /meta/countries` → `[{ code, name }]` (collapsed). Sort client-side with `Intl.Collator(lang)`. `GET /meta/enums` → enum lists.
- `GET /redirects/resolve?path=` → `{ toPath, statusCode }`, or 404 when there's no match.
- **B15 (mock):** `GET /sitemap-index` → `{ pages: [{ slug, updatedAt }], posts: [{ slug, updatedAt }], categories: [{ slug }] }`.
- `POST /contact` `{ name, email, phone?, subject: scholarship|partnership|feedback|other, body, website?, formRenderedAt }` → `{ ok: true }`.
  - A honeypot hit, **or a submit less than 3s after `formRenderedAt`**, is silently dropped but still returns `ok`.
  - Set `formRenderedAt` in the browser after hydration. e2e against the real API must wait more than 3s or backdate the value.
- `POST /newsletter` `{ email, website?, formRenderedAt }`: same rules as contact.

## Apply + portal
- `POST /applications` (step-1 fields, strict) → `{ reference, csrfToken }` + sets `sf_app_sid`.
- `PATCH /portal/application`: a partial of every step field + `consent`, **strict** (unknown keys → 400).
  - **`null` is accepted only for** `middleName, idNumber, currentJob, scholarshipNote`. Required fields must be **omitted** when empty, never sent as `null` or `""`.
- `POST /portal/application/submit`: the full schema + `consent: true`.
- Field rules:
  - `birthDate` is `YYYY-MM-DD`
  - `nationality` is ISO alpha-2
  - `gender` is `male|female`
  - `degreeLevel` is `bachelor|master|phd`
- `GET /portal/me` → `{ reference, status, currentStep, personal{…}, study{…}, submittedAt, decidedAt, timeline: [{ key: received|documents|review|interview|decision, state: done|now|pending }], actionNeeded: { type: document_rejected|documents_requested, docType?, docTypes?, reason?, message? } | null }`. `csrfToken` is added by **B16**.
- `GET /portal/notifications` → applicant-visible events only.
- `GET /portal/documents` → `{ documents[], completeness: { done, required, missingTypes[] } }`.
  - Use only `id, docType, originalName, mime, sizeBytes, status (under_review|accepted|rejected), rejectionReason, createdAt`.
  - **Ignore `storageKey` and `checksum`**, which are still leaked until **B19**.
- `POST /portal/documents`: multipart `file` + `docType` (`id_copy|certificate|admission_letter|other`; the first three are required). Limits: 5 MB, PDF/JPEG/PNG detected by magic bytes. `GET /portal/documents/:id/file`, `DELETE /portal/documents/:id` (draft only).
- `GET /portal/interview-slots` → `[{ id, startsAt, endsAt, location, applicationId: null }]`. The list is empty unless the status is `interview`. `POST /portal/interview` `{ slotId }` (numeric string).
- `POST /portal/auth/request-otp` `{ identifier }` (reference or email today; phone + `channel` after **B1/B2**) → always `{ ok: true }`.
- `POST /portal/auth/verify-otp` `{ identifier, code: /^\d{6}$/ }` → `{ csrfToken }`.
- `POST /portal/auth/logout`.
- Statuses: `draft new under_review docs_missing interview accepted rejected`.

## Staff
- `GET /admin/roles` **does not exist yet (B17)**. Until then, mock it with the matrix below (keep a copy in `core/auth/role-matrix.ts`):
  - applications / interview-slots: admin, reviewer
  - content (pages, news, work-areas, board, stats, about-items, partners, documents, media, redirects): admin, editor. `redirects` and `media` are open to all staff today; B4/B5 restrict them to this.
  - messages / testimonials / newsletter: admin, support
  - users / settings / mail / sms / audit / cache: admin
