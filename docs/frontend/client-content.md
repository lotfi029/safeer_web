# Content taken from the current site (safeer-sa.org)

Collected on 2026-09-28 from the association's live WordPress site. Most content lives in the API's database, so
it is entered through the admin screens (or `safeer_api`'s seed), not in this repo. The logo is the one exception;
it is a frontend asset (§1).

**Not taken:** the current site is built on a medical/clinic theme ("Medcity"), and much of it is still the theme's
demo content. Examples: "since 1990", "7541 reviews", "Available 24/7", the doctor profiles, the English health
articles, a `+20 106 124 5741` phone number and `Richard@farost.com`. None of that belongs to the association, and
none of it is used. The board-formation letter lists members' **national ID numbers**, which are personal data and
must never be published or copied.

## 1. Logo (done in this repo)

The client supplied the **official SVG** (`شعار_سفير.svg`), kept unchanged as
`docs/brand/safeer-logo-official.svg`. It is the full lockup on a 2000×2000 canvas: the mark, then the calligraphic
wordmark "جمعية سفير الدعوية / لطلاب المنح الدوليين".

`node scripts/build-brand.mjs` derives the app's assets from it. Nothing is traced or redrawn: the official paths are
only cropped, and the file's `<style>` classes are turned into `fill` attributes, so the SVGs need no stylesheet.

| File | What |
|---|---|
| `public/brand/safeer-mark.svg` | The mark alone, vector, 10 KB. Used by `<app-logo>` and the intro |
| `public/brand/safeer-lockup.svg` | Mark + wordmark, vector. Available for print, footer or social use |
| `public/brand/safeer-logo.png` | The mark, 512 px tall. The JSON-LD `logo` |
| `public/brand/apple-touch-icon.png`, `public/favicon.ico` | The mark on white, 180 px / 16-32-48 px. The favicon used to be Angular's default |
| `docs/brand/safeer-logo-site-original.png` | The PNG from safeer-sa.org, kept for reference (superseded) |

## 2. Figures (admin → Figures, `/admin/stats`)

The API seed has four figures. The site shows three counters on its work-areas page:

| Site counter | Value | Seeded figure | Suggested entry |
|---|---|---|---|
| أعوام نقدم فيها مجموعة واسعة من الرعاية والدعم | **2** | أعوام من الخبرة = 2 | Already correct |
| إجمالى عدد المستفيدين | **200** | طالب وطالبة مستفيد = *(empty)* | Set **200**, after the client confirms these are all students (the site says "total beneficiaries") |
| عدد المسلمون الجدد | **100** | *(none)* | Add a figure only if the client wants it on the new site |
| — | — | برنامج وفعالية = *(empty)* | Not on the site: **ask the client** |
| — | — | جهة شريكة = *(empty)* | Not stated. The partner logos on the site don't give a clean count (home and the partners page differ): **ask the client** |

"2 years" came from a static counter. Registration was 1444/01/12 AH (about July 2022), so the value will need
updating over time.

## 3. Registration (licenses page: `شهادة تسجيل جمعية سفير.pdf`)

From the National Center for Non-Profit Sector certificate:

| Field | Value |
|---|---|
| Registered name | سفير الدعوية لطلاب المنح |
| Registration number | **2340** |
| Registration date | **1444/01/12 AH** |
| Valid until | **1448/01/12 AH** (four years; must be renewed if details change) |
| Issued under decision | 13387 of 1444/01/12 AH |
| Identifier (الرقم التعريفي) | 2524 |
| Headquarters | Riyadh |
| Service scope | All regions of the Kingdom |

The site settings have no field for these numbers. Two options:
- Upload the certificate itself under **admin → Documents**, in the licenses category. The licenses page already
  lists it on the old site.
- Or mention the registration number in the footer's rights line (**admin → Settings**), if the client wants that.

Other documents on the old site, to upload the same way:
- the board-formation letter (`تشكيل مجلس الإدارة.pdf`). **Only if the client approves publishing it**, because it
  shows national IDs; better to ask for a redacted copy.
- the auditor's report (`تقرير المراجع القانوني.pdf`)

## 4. Contact and social (admin → Settings)

| Field | Site value | In the seed |
|---|---|---|
| Phone | +966 53 464 6648 | Same |
| Email | info@safeer-sa.org | Same |
| Address | الرياض - حي السويدي - شارع سدير | Same |
| X | https://x.com/safeerorg | Set `xUrl` |
| Facebook, Instagram | Icons on the site link to `#` (no real accounts linked) | Leave empty until the client gives the URLs |
| Map | "Get directions" goes to `https://goo.gl/maps/aDe9zcQ6zp6GVBgD7` | Not an embed URL. The contact map needs `mapLat`/`mapLng`, or a Google Maps / OpenStreetMap **embed** URL: ask the client for the exact pin |

## 5. Board (admin → Board)

The board page (matching the formation letter) lists:
- رئيس المجلس: د. عبد الله بن دجين بن علي السهلي
- نائب الرئيس: د. فهد بن سعيد بن ناصر بن سعيد
- المشرف المالي: د. سالم بن عبد الله بن عامر العجمي
- عضو: د. عبد الرحمن عبد الكريم البراهيم اليزيد
- عضو: د. عثمان بن سليمان بن حمد العراجه
- المدير التنفيذي: أ. شعلان عبدالله الشمراني

These already match the API seed (`mocks/fixtures/board.json`, recorded from it) word for word. Nothing to change.
No photos are published, except one in the site's uploads, whose owner and consent are unknown.

## 6. Still owed by the client

- The official logo **SVG**.
- The values for "programmes and events" and "partner organisations".
- Whether to show "new Muslims" (100).
- The Facebook and Instagram URLs, and the exact map pin.
- Partner logos in usable quality, with names.
- Photos with permission.
