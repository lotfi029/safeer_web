# safeer_api contract notes (`v1.0.0-rc1`, `e86b3b5`)

These notes describe the **live** API at `lotfi029/safeer_api@v1.0.0-rc1`, read from its source (the snapshot in `src/` next to this file). What changed and why is in `API-CHANGES.md`, a copy of the backend's own file. The role matrix and the rest of the backend architecture are in `ARCHITECTURE.md`. `openapi.json` types requests only; response shapes come from `src/**/public-*.ts`, the controllers and the listed services. Re-snapshot with `node scripts/snapshot-api.mjs <path-to-safeer_api> <ref>` (see `README.md`).

Nothing below is mocked or planned: every B-item (B1–B19), C-item (C1–C47) and A-item (A1–A12) is in this release.

## Transport
- Base: `/api/v1`. Files: `/files/:publicId` (original) and `/files/:publicId/:variant`, both **outside** `/api/v1`.
- Image variants: `thumb` 400, `card` 800, `full` 1600. All are **WebP**, generated with `withoutEnlargement`. For small originals the real widths collapse, so build `srcset` descriptors from `min(specWidth, asset.widthPx)` and dedupe. `widthPx`/`heightPx` on the asset belong to the original.
- Caching (C24, C25): public originals and PDFs are cached for 5 minutes; variants are immutable. A public document is served only while its category is published.
- **Locale:** `?lang=ar|en` → `Accept-Language` → `ar`. Responses outside `/admin/*` collapse every `xAr`/`xEn` pair into `x`, falling back to Arabic when the English value is empty or whitespace (C39). `/admin/*` responses keep both raw fields, and admin DTOs trim every `*En` field.
- **Cookies** (HttpOnly, SameSite=**Strict**, path `/`, Secure in production):
  - staff `sf_sid`
  - applicant `sf_app_sid`

  Strict means the first navigation in from an external link (e.g. an email) carries no cookie. That's fine, because admin and portal are CSR and their first API fetch is same-site.
- **CSRF:** header `X-CSRF-Token` on non-GET requests that carry a session. The token comes in the **response body** of:
  - `POST /admin/auth/login`
  - `GET /admin/me`
  - `POST /applications`
  - `POST /portal/auth/verify-otp`
  - `GET /portal/me` (B16: the same token verify-otp issued, so it survives a reload)

  Public writes (`/contact`, `/newsletter*`, `POST /applications`, OTP request/verify) need no token.

## Errors (`application/problem+json`)
```
{ type: "https://safeer-sa.org/errors/<kebab-code>", title, status, code, requestId, ...extra }
```
- Validation: `code: "VALIDATION_FAILED"`, `extra.issues` = zod v4 issues `[{ path: (string|number)[], message, code }]`. Map `path[0]` to the form field.
- `DOCUMENTS_INCOMPLETE` → `extra.missing: DocType[]`. `INVALID_STATUS_TRANSITION` → `extra.{from,to}`.
- Codes (`src/common/problem-details/error-codes.ts`): `VALIDATION_FAILED UNAUTHENTICATED FORBIDDEN NOT_FOUND ASSET_IN_USE RESOURCE_IN_USE ALT_TEXT_REQUIRED LAST_ADMIN SLUG_TAKEN PUBLISH_BLOCKED RATE_LIMITED UNSUPPORTED_PROVIDER SOURCE_TYPE_MISMATCH UNKNOWN_VARIABLE FEATURE_DISABLED NOT_IMPLEMENTED APPLICATION_LOCKED OTP_INVALID DOCUMENTS_INCOMPLETE SLOT_ALREADY_BOOKED INTERVIEW_NOT_AVAILABLE INVALID_STATUS_TRANSITION APPLICATION_EXISTS INVALID_ASSIGNEE QUOTA_EXCEEDED DOCUMENT_NOT_REVIEWABLE DOCUMENT_SUPERSEDED REDIRECT_CHAIN`, plus the fallbacks `CONFLICT INTERNAL_ERROR`.
- **Rate limits** (429 `RATE_LIMITED`, per IP unless noted):
  - `POST /contact`: 3/h
  - `POST /newsletter`: 5/h; `newsletter/confirm` and `newsletter/unsubscribe`: 10/h each
  - `POST /applications`: 5/h
  - `POST /portal/auth/request-otp`: 5/h, plus 5 per 15 min per identifier and per application (C22)
  - `POST /portal/auth/verify-otp`: 10/h
  - `POST /portal/documents`: 20/h
  - `POST /portal/interview` and `DELETE /portal/interview`: 5/h each (A9)
  - `POST /admin/auth/login`: 5/min, plus 5/min per email; `admin/auth/forgot` and `admin/auth/reset/:token`: 3/h; `PATCH admin/auth/password`: 5 per 15 min
  - global: 100/min

## Public endpoints
- `GET /site` → `{ settings, nav: [{ slug, label }], contact: { phone, email, address } }`.
  - `nav` slugs, fixed order: `home about board work scholarships news testimonials partners documents contact`.
  - **Slug ≠ route:** map `work` → `/:lang/work-areas` and `home` → `/:lang`.
  - `settings` (`src/site-settings/public-site-settings.ts`): org name/tagline/blurb/rights line, `phone`, `email`, `address`, social URLs (`facebookUrl instagramUrl xUrl youtubeUrl linkedinUrl whatsappUrl tiktokUrl`), **`mapEmbedUrl`, `mapLat`, `mapLng`** (A12), `enEnabled`, SEO title/description.
  - **Contact map (A12):** `mapEmbedUrl` is an iframe `src`. The API only accepts https Google Maps embeds (`https://www.google.com/maps/embed…`) or OpenStreetMap (`https://www.openstreetmap.org/…`); the frontend's CSP `frame-src` allows exactly those two origins. `mapLat` (−90…90) and `mapLng` (−180…180) are the pin.
- `GET /home` → `{ settings, sections[], aboutItems: { goals[], carePillars[] }, stats[], workAreas[] (with items), news[3], testimonials[2], partners[] }`.
  - `sectionKey` values in seed order: `hero about impact work_areas student_care news testimonials partners cta`.
  - `partners` is seeded **unpublished**. A `null` stat value means "show `[—]`".
- `GET /pages/:slug` → page meta + published sections. Seeded slugs: `home about board work scholarships news article testimonials partners documents contact`. `about` has sections `intro vision_mission goals governance`; `scholarships` has `hero pillars steps requirements cta` (migration 014).
- **Rich text (C26, C40):** page-section bodies, about-item bodies and the news body are **sanitized HTML** rendered from Markdown. `#` renders as `<h2>`; GFM tables render as `<table>` with `align` on cells.
- `GET /about-items?kind=vision,mission,goal,care_pillar,scholarship_step,requirement` (all kinds when omitted) → `{ [kind]: [{ id, icon, title, body, sortOrder }] }`, published only, sorted. An unknown kind is a 400 (C42).
- `GET /testimonials` → `{ featured[], list[], themes[] }`.
- `GET /board` → `{ board: BoardMember[], executive: BoardMember[] }`, grouped by `grp` (`src/board/board.controller.ts`). Members carry `bio` (B12).
- `GET /work-areas`, `GET /partners?category=`, `GET /documents`: see `src/**/public-*.ts`. An unknown partner category is a 400 (C42).
- `GET /news?category=&q=&page=&limit=` → `{ data, total, page, limit }`. An unknown `category` is a **400** (C42): render it as not-found. Also `GET /news/featured` and `GET /news-categories`.
- `GET /news/:slug` → post + `related[]`. `body` is sanitized HTML; `readMinutes` matches the body in the requested language (C39).
  - `?preview=<token>` shows an unpublished post. With a valid token the response has `previewFileQuery` (`preview=<token>&post=<id>`, C41); append it to that post's `/files/…` URLs so an unpublished cover loads without a session. `?preview` is ignored on every other route (C24).
- `GET /meta/countries` → `[{ code, name }]` (collapsed). Sort client-side with `Intl.Collator(lang)`. `GET /meta/enums` → enum lists.
- `GET /redirects/resolve?path=` → `{ toPath, statusCode }`, or 404 when there's no match.
- `GET /sitemap-index` → `{ pages: [{ slug, updatedAt }], posts: [{ slug, updatedAt }], categories: [{ slug, updatedAt }] }`.
- `POST /contact` `{ name, email, phone?, subject: scholarship|partnership|feedback|other, body, website?, formRenderedAt }` → `{ ok: true }`.
  - `name` accepts Arabic and Latin letters, spaces, `'` and `-` only (C16).
  - A honeypot hit, **or a submit less than 3s after `formRenderedAt`**, is silently dropped but still returns `ok`.
  - Set `formRenderedAt` in the browser after hydration. e2e against the real API must wait more than 3s or backdate the value.
- **Newsletter (C27):**
  - `POST /newsletter` `{ email, website?, formRenderedAt }` (same rules as contact) → `{ ok: true, pendingConfirmation: true }`, and mails a confirmation link.
  - The address counts as subscribed only after `POST /newsletter/confirm { email, token }`. `POST /newsletter/unsubscribe { email, token }` takes the signed token from a newsletter mail. Both DTOs are strict, and a bad or mismatched pair is a 400.
  - Mailed links: `/{locale}/newsletter/confirm?email=…&token=…` and `/{locale}/newsletter/unsubscribe?email=…&token=…`.

## Apply + portal
- `POST /applications` (step-1 fields, strict) → `{ reference, csrfToken }` + sets `sf_app_sid`. A second active application for the same email or phone is 409 `APPLICATION_EXISTS` (B2, non-enumerating).
- `PATCH /portal/application`: a partial of every step field + `consent`, **strict** (unknown keys → 400). **`draft` only**; any other status is 409 `APPLICATION_LOCKED` (C15).
  - **`null` is accepted only for** `middleName, idNumber, currentJob, scholarshipNote`. Required fields must be **omitted** when empty, never sent as `null` or `""`.
- `PATCH /portal/application/corrections` (C15): **`docs_missing` only**. A strict partial of `firstName middleName lastName birthDate nationality idNumber university major degreeLevel` (at least one; never email or phone) → `{ status, corrected: string[] }`. It records an `APPLICANT_CORRECTED` event.
- `POST /portal/application/submit`: the full schema + `consent: true`.
- Field rules:
  - `birthDate` is `YYYY-MM-DD`
  - `nationality` is ISO alpha-2
  - `gender` is `male|female`
  - `degreeLevel` is `bachelor|master|phd`
  - first, middle and last names: Arabic and Latin letters, spaces, `'` and `-` only (C16)
- `GET /portal/me` → `{ reference, status, currentStep, personal{…}, study{…}, submittedAt, decidedAt, timeline: [{ key: received|documents|review|interview|decision, state: done|now|pending }], actionNeeded: { type: document_rejected|documents_requested, docType?, docTypes?, reason?, message? } | null, recentEvents[], interview: { id, startsAt, endsAt, location } | null, csrfToken }`.
- `GET /portal/notifications?page=&limit=` (C35) → **paged** `{ data, total, page, limit }` (default 20, max 50), newest first. Items are `{ id, type, data, createdAt }`, the same shape as `recentEvents`; never `actorId`.
  - Applicant-visible types (`visibleToApplicant`): `STARTED SUBMITTED STATUS_CHANGED DOCS_REQUESTED DOCS_RECEIVED DOCUMENT_REJECTED APPLICANT_CORRECTED INTERVIEW_BOOKED INTERVIEW_CANCELLED`. `DOCUMENT_ACCEPTED`, `DOCS_RESUBMITTED` and `REVIEWER_ASSIGNED` are staff-only.
- **Documents (B19, C18, C19):**
  - `GET /portal/documents` → `{ documents[], completeness: { done, required, missingTypes[] } }`. Each document is `{ id, docType, originalName, mime, sizeBytes, status (under_review|accepted|rejected), rejectionReason, createdAt }`: no storage key or checksum.
  - `POST /portal/documents`: multipart `file` + `docType` (`id_copy|certificate|admission_letter|other`; the first three are required). Limits: 5 MB, PDF/JPEG/PNG detected by magic bytes. The API keeps **one current document per type**: a new upload supersedes the previous one of that type.
  - Quotas: 20 uploads/h, and 30 uploads or 50 MB per application in total. Past that: 409 `QUOTA_EXCEEDED`.
  - `GET /portal/documents/:id/file` (RFC 5987 `filename*`, so Arabic names survive). `DELETE /portal/documents/:id` → `{ deleted: true }` (draft only).
- **Interview (C17, A9):**
  - `GET /portal/interview-slots` → future open slots `[{ id, startsAt, endsAt, location }]`. Empty unless the status is `interview`, and empty once the applicant has booked.
  - `POST /portal/interview { slotId }` → the booked slot (201). A slot someone holds, or booking again, is 409 `SLOT_ALREADY_BOOKED`; a past slot is 409 `INTERVIEW_NOT_AVAILABLE`.
  - `DELETE /portal/interview` → `{ cancelled: true }`, or 404 if nothing is booked.
  - Booking and cancelling are each **limited to 5/h per IP** (429). Booking, cancelling and a staff change to a booked slot each send a mail and an SMS.
- **OTP sign-in (A1, A4, C1, C22):**
  - `POST /portal/auth/request-otp { identifier, channel?: sms|email }`. The identifier is a reference, an email or a phone. It answers `{ ok: true, channelHint }` **at once, before the identifier is even looked up**, and identically for matches and misses. The answer never means a message went out: the code arrives a moment later, usually within a second, up to ~5 s when an SMS times out and falls back to email.
  - `POST /portal/auth/verify-otp { identifier, code: /^\d{6}$/ }` → `{ csrfToken }` + sets `sf_app_sid`. Every failure is one 401 `OTP_INVALID`.
  - A new code invalidates older ones; a code allows 5 attempts. **Ten wrong codes inside an hour lock OTP sign-in for 1 hour; 30 in a UTC day lock it until the next UTC day.** Only a wrong code for a live code counts. While locked, verify answers `OTP_INVALID` and request-otp sends nothing but answers the same. If the UI explains a lockout, say "try again in an hour", never "tomorrow".
  - Real-API e2e: `GET /api/v1/__dev/otp/:applicationId` (development/test only) waits for sends still in flight, then returns `{ code, channel, issuedAt }`; `POST /api/v1/__dev/settle` waits for all background work. Both are 404 elsewhere.
- `POST /portal/auth/logout`.
- Statuses: `draft new under_review docs_missing interview accepted rejected`.

## Staff
- **Links in mail (C2):** `/{locale}/admin/accept/{token}` → `POST /admin/auth/accept/:token`; `/{locale}/admin/reset/{token}` → `POST /admin/auth/reset/:token`; `/{locale}/admin/messages/{id}`. Staff links always use `ar`.
- **Login (A2, A3, C3, C12):** a disabled account can't log in, reset or accept an invite. Every refused login takes the same time, whether or not the email exists. Ten failed logins lock the account for 15, then 30, then 60 min, **never longer than 1 h**. The backoff resets 24 h after the last lock, and the failure count 24 h after the last wrong password.
- `PublicUser` → `{ id, name, email, role, status: active|disabled|invited, isLocked, lockedUntil, failedLogins, lastLoginAt, createdAt, updatedAt }`. `PATCH /admin/users/:id` takes `{ status }` and `{ unlock: true }`.
- `POST /admin/auth/forgot` answers without waiting for the mail (C33).
- **Roles (B17):** `GET /admin/roles` (any staff) → `{ roles, matrix }`, where `matrix` maps an **area** to its roles (`src/auth/role-matrix.ts`). The frontend's `core/auth/role-matrix.ts` is a typed copy used only if the call fails.

  | Area | Roles | Covers |
  |---|---|---|
  | `applications` | admin, reviewer | applications, documents, notes, interview slots, CSV export |
  | `applications.delete` | admin | anonymise an application |
  | `content` | admin, editor | pages/sections, news + categories, work areas, board, stats, about items, partners, documents, media, redirects |
  | `redirects.delete` | admin | delete a redirect |
  | `inbox` | admin, support | contact messages, testimonials + themes, newsletter subscribers |
  | `inbox.delete` | admin | delete a contact message |
  | `users` | admin | staff accounts, invitations |
  | `settings` | admin | site settings, mail/SMS settings, templates and logs, cache |
  | `audit` | admin | audit log |

  `admin/me`, `admin/auth/*`, `admin/overview`, `admin/preview-token` and `admin/roles` are open to any signed-in staff member.
- **Overview (C20, A5):** `GET /admin/overview` → `{ statCards, series?, latestApplications?, contentAlerts, badges, recentAuditLog }`. Application figures (`statCards.newApplications|underReview|acceptedThisMonth`, `badges.newApplications`, `series`, `latestApplications`) are **admin + reviewer only**. `statCards.unreadMessages` and `badges.unreadMessages` are **admin + support only**: editors get no message counts at all. `recentAuditLog` is admin-only (an empty array otherwise), each entry `{ id, action, entityType, entityId, entityLabel, actorId, actorName, createdAt }` with no diff and no IP hash.
- **Applications:**
  - Status changes are transactional: of two conflicting changes, exactly one succeeds and the other is 409 (C6).
  - Reviewing a superseded document, or one on a draft/accepted/rejected application, is 409 `DOCUMENT_NOT_REVIEWABLE` (C34).
  - `DELETE /admin/applications/:id` (area `applications.delete`) anonymises → `{ anonymized: true, reference }` (C27).
  - The detail's `personal.idNumber` is decrypted. The CSV export's ID column is `ID (last 4)`, masked as `••••1234` (C28). The export sends `X-Truncated: true|false` (exposed through CORS) and is capped at 5000 rows (C36).
  - **Documents in the detail (B19, A11):** the portal fields plus `reviewedBy`, `reviewedAt`, `supersededAt` and **`downloadPath`**: the file route relative to the API base (`admin/applications/{id}/documents/{docId}/file`), or **`null`** for a superseded document. Show a download link only when `downloadPath` is set. The file route answers 410 `DOCUMENT_SUPERSEDED` for a superseded document.
- **Interview slots (C17):** `endsAt` must be after `startsAt`, on create and on a partial PATCH against the stored values; otherwise 400.
- **News (C13, C14):** every create/update response carries `warnings` (usually `[]`); publishing without a cover succeeds with `warnings: ["COVER_MISSING"]`, a non-blocking notice. Publishing without `publishedOn` sets it to today (UTC). `slug` must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`, be at most 180 characters and not be reserved (`featured new edit preview admin api sitemap search feed rss`).
- **Pages (B10, C14):** a page's `slug` is fixed after creation (a PATCH carrying it is 400). Each row of `GET /admin/pages` has `sectionsCount`.
- **URLs (C10):** button, partner and social URLs must be `https:`, `http:`, `mailto:` or `tel:` (buttons may also be a site path). Redirects must be site paths with `from ≠ to`; chains are 409 `REDIRECT_CHAIN`.
- **Settings (A12):** `GET/PUT /admin/settings` take and return `mapEmbedUrl` (allow-listed as above), `mapLat` (−90…90) and `mapLng` (−180…180); anything else is 400.
- **Newsletter admin (C27):** subscribers have a `pending` status until confirmed; the CSV has a "Confirmed at" column.
