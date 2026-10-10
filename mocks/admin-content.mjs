/**
 * Admin content routes of the mock API (Stage 2, Phase 8): the CRUD kernel every collection shares
 * (safeer_api common/crud/crud.factory.ts) plus the news, testimonial, page and media specifics.
 * State starts from rows recorded from the real API (fixtures/adminContent.json, recorded by
 * scripts/record-admin-shapes.mjs --content); response shapes are checked against rc1 by
 * mocks/admin-shapes.test.mjs. This admin state is separate from the public fixtures.
 */

const RESERVED_POST_SLUGS = new Set([
  'featured',
  'new',
  'edit',
  'preview',
  'admin',
  'api',
  'sitemap',
  'search',
  'feed',
  'rss',
  'categories',
  'category',
]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Collection behaviour, as each controller configures the kernel. */
export const KERNEL = {
  'work-areas': {
    area: 'content',
    publishable: true,
    sortable: true,
    search: ['titleAr', 'titleEn'],
    required: ['titleAr'],
    defaults: { isPublished: true, icon: null, titleEn: null },
  },
  'work-area-items': {
    area: 'content',
    publishable: true,
    sortable: true,
    search: ['textAr', 'textEn'],
    required: ['workAreaId', 'textAr'],
    defaults: { isPublished: true, textEn: null },
  },
  board: {
    area: 'content',
    publishable: true,
    sortable: true,
    search: ['nameAr', 'nameEn', 'roleAr', 'roleEn'],
    required: ['nameAr', 'roleAr', 'grp'],
    defaults: {
      isPublished: true,
      isLead: false,
      nameEn: null,
      roleEn: null,
      bioAr: null,
      bioEn: null,
      photoAssetId: null,
    },
  },
  testimonials: {
    area: 'inbox',
    sortable: true,
    search: ['authorName', 'quoteAr', 'quoteEn'],
    required: ['quoteAr', 'authorName'],
    defaults: {
      status: 'pending',
      isFeatured: false,
      source: 'manual',
      sourceMessageId: null,
      quoteEn: null,
      authorDescAr: null,
      authorDescEn: null,
    },
  },
  'testimonial-themes': {
    area: 'inbox',
    sortable: true,
    search: ['titleAr', 'titleEn'],
    required: ['titleAr'],
    defaults: { isImprovement: false, titleEn: null, descriptionAr: null, descriptionEn: null },
  },
  partners: {
    area: 'content',
    publishable: true,
    sortable: true,
    search: ['nameAr', 'nameEn'],
    required: ['nameAr', 'category'],
    defaults: { isPublished: true, nameEn: null, url: null, logoAssetId: null },
  },
  'doc-categories': {
    area: 'content',
    sortable: true,
    search: ['slug', 'nameAr', 'nameEn'],
    required: ['slug', 'nameAr'],
    unique: 'slug',
    timestamps: false,
    defaults: { isPublished: true, nameEn: null },
    usedBy: [['documents', 'categoryId']],
  },
  documents: {
    area: 'content',
    publishable: true,
    search: ['titleAr', 'titleEn'],
    required: ['categoryId', 'titleAr'],
    defaults: {
      isPublished: false,
      titleEn: null,
      assetId: null,
      docDate: null,
      downloadCount: 0,
      sortOrder: 0,
    },
  },
  stats: {
    area: 'content',
    publishable: true,
    sortable: true,
    search: ['labelAr', 'labelEn'],
    required: ['labelAr'],
    defaults: { isPublished: true, value: null, labelEn: null, subAr: null, subEn: null },
  },
  'about-items': {
    area: 'content',
    publishable: true,
    sortable: true,
    search: ['titleAr', 'titleEn'],
    required: ['kind', 'titleAr'],
    defaults: { isPublished: true, icon: null, titleEn: null, bodyAr: null, bodyEn: null },
  },
  pages: {
    area: 'content',
    publishable: true,
    search: ['slug', 'titleAr', 'titleEn'],
    required: ['slug', 'titleAr'],
    unique: 'slug',
    defaults: {
      isPublished: true,
      needsReview: false,
      titleEn: null,
      metaTitleAr: null,
      metaTitleEn: null,
      metaDescriptionAr: null,
      metaDescriptionEn: null,
    },
  },
  'page-sections': {
    area: 'content',
    publishable: true,
    sortable: true,
    search: ['headingAr', 'headingEn', 'labelAr', 'labelEn'],
    required: ['pageId', 'sectionKey'],
    defaults: { isPublished: true },
  },
  news: {
    area: 'content',
    publishable: true,
    search: ['titleAr', 'titleEn', 'excerptAr', 'excerptEn'],
    required: ['titleAr', 'categoryId'],
    defaults: {
      isPublished: false,
      isFeatured: false,
      isLegacy: false,
      titleEn: null,
      excerptAr: null,
      excerptEn: null,
      bodyAr: null,
      bodyEn: null,
      coverAssetId: null,
      publishedOn: null,
    },
  },
  'news-categories': {
    area: 'content',
    sortable: true,
    search: ['slug', 'nameAr', 'nameEn'],
    required: ['slug', 'nameAr'],
    unique: 'slug',
    usedBy: [['news', 'categoryId']],
  },
};

function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

/**
 * @param {object} ctx `{ db, json, problem, nowIso, guard, audit, fixtures }` from mocks/admin.mjs
 */
export function contentRoutes(ctx) {
  const { db, json, problem, nowIso, guard } = ctx;
  const seed = structuredClone(ctx.fixtures.adminContent ?? {});
  db.content ??= Object.fromEntries(Object.keys(KERNEL).map((k) => [k, seed[k] ?? []]));
  db.media ??= seed.media ?? [];
  const table = (endpoint) => db.content[endpoint];
  const nextId = () => String(++db.seq);
  const today = () => new Date().toISOString().slice(0, 10);

  const invalid = (path, message) =>
    problem(400, 'VALIDATION_FAILED', { issues: [{ path: [path], message, code: 'custom' }] });

  /** ALT_TEXT_REQUIRED: an `*AssetId` pointing at an image without Arabic alt text. */
  function altProblem(body) {
    for (const [k, v] of Object.entries(body ?? {})) {
      if (!/AssetId$/i.test(k) && k !== 'assetId') continue;
      const asset = v && db.media.find((a) => a.id === String(v));
      if (asset?.kind === 'image' && !asset.altAr)
        return problem(409, 'ALT_TEXT_REQUIRED', { assetId: asset.id });
    }
    return null;
  }

  function withWarnings(endpoint, row) {
    if (endpoint !== 'news') return row;
    return { ...row, warnings: row.isPublished && !row.coverAssetId ? ['COVER_MISSING'] : [] };
  }

  function listRows(endpoint, query) {
    const spec = KERNEL[endpoint];
    let rows = [...table(endpoint)];
    const q = (query.get('q') ?? '').trim().toLowerCase();
    if (q && spec.search)
      rows = rows.filter((r) =>
        spec.search.some((f) =>
          String(r[f] ?? '')
            .toLowerCase()
            .includes(q),
        ),
      );
    const published = query.get('published');
    if (spec.publishable && (published === 'true' || published === 'false')) {
      rows = rows.filter((r) => !!r.isPublished === (published === 'true'));
    }
    for (const [k, v] of query.entries()) {
      if (['q', 'published', 'page', 'limit', 'lang'].includes(k)) continue;
      if (rows.length && !(k in rows[0])) continue;
      // Like the API, column filters compare as strings (booleans need 1/0).
      rows = rows.filter((r) =>
        typeof r[k] === 'boolean' ? String(Number(r[k])) === v : String(r[k] ?? '') === v,
      );
    }
    rows.sort(
      spec.sortable
        ? (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || Number(a.id) - Number(b.id)
        : (a, b) => Number(b.id) - Number(a.id),
    );
    if (endpoint === 'pages') {
      rows = rows.map((p) => ({
        ...p,
        sectionsCount: table('page-sections').filter((s) => s.pageId === p.id).length,
      }));
    }
    const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 20));
    const page = Math.max(1, Number(query.get('page')) || 1);
    return { data: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit };
  }

  function checkBody(endpoint, body, { create }) {
    const spec = KERNEL[endpoint];
    if (create) {
      for (const f of spec.required ?? []) {
        if (body?.[f] === undefined || body[f] === null || body[f] === '')
          return invalid(f, 'Required');
      }
    }
    if (endpoint === 'pages' && !create && 'slug' in (body ?? {}))
      return invalid('slug', 'Unrecognized key');
    if (endpoint === 'news' && create && ('slug' in (body ?? {}) || 'createdBy' in (body ?? {}))) {
      return invalid('slug' in body ? 'slug' : 'createdBy', 'Unrecognized key');
    }
    for (const key of ['slug', 'sectionKey']) {
      if (body?.[key] !== undefined && key === 'slug' && !SLUG_RE.test(String(body[key]))) {
        return invalid('slug', 'must be lower-case letters and digits separated by single hyphens');
      }
    }
    if (endpoint === 'news' && body?.slug !== undefined && RESERVED_POST_SLUGS.has(body.slug)) {
      return invalid('slug', 'this slug is reserved');
    }
    if (body?.url && !/^(https?:\/\/|mailto:|tel:)/i.test(body.url)) {
      return invalid('url', 'must be an http(s), mailto: or tel: URL');
    }
    // safeUrl({ relative: true }): absolute http(s)/mailto:/tel:, or a site path.
    for (const key of ['primaryButtonUrl', 'secondaryButtonUrl']) {
      const v = body?.[key];
      if (v && !/^(https?:\/\/|mailto:|tel:)/i.test(v) && !/^\/(?!\/)[^\s\\]*$/.test(v)) {
        return invalid(key, 'must be an http(s), mailto: or tel: URL, or a path on the site');
      }
    }
    if (
      endpoint === 'stats' &&
      body?.value !== undefined &&
      body.value !== null &&
      !/^\d+$/.test(String(body.value))
    ) {
      return invalid('value', 'Invalid');
    }
    return altProblem(body);
  }

  function conflict(endpoint, body, id) {
    const spec = KERNEL[endpoint];
    if (spec.unique && body?.[spec.unique] !== undefined) {
      if (table(endpoint).some((r) => r.id !== id && r[spec.unique] === body[spec.unique]))
        return problem(409, 'CONFLICT');
    }
    if (endpoint === 'page-sections' && (body?.sectionKey || body?.pageId)) {
      const current = id ? table(endpoint).find((r) => r.id === id) : {};
      const pageId = body.pageId ?? current?.pageId;
      const key = body.sectionKey ?? current?.sectionKey;
      if (table(endpoint).some((r) => r.id !== id && r.pageId === pageId && r.sectionKey === key))
        return problem(409, 'CONFLICT');
    }
    return null;
  }

  function onPublish(endpoint, row, wasPublished) {
    if (endpoint === 'news' && row.isPublished && !wasPublished && !row.publishedOn)
      row.publishedOn = today();
  }

  const routes = [];
  const base = (endpoint) => endpoint.replace(/[-/]/g, (c) => `\\${c}`);

  // Specific routes first (they would otherwise match `:id`).
  routes.push(
    [
      'DELETE',
      /^\/api\/v1\/admin\/news\/legacy$/,
      ({ req }) => {
        const g = guard(req, 'content', { write: true });
        if (g.error) return g.error;
        const before = table('news').length;
        db.content.news = table('news').filter((p) => !p.isLegacy);
        return json(200, { deleted: before - db.content.news.length });
      },
    ],
    [
      'GET',
      /^\/api\/v1\/admin\/preview-token$/,
      ({ req, query }) => {
        const g = guard(req);
        if (g.error) return g.error;
        if (query.get('collection') !== 'posts' || !query.get('id'))
          return invalid('collection', 'Invalid');
        const post = table('news').find((p) => p.id === query.get('id'));
        if (!post) return problem(404, 'NOT_FOUND');
        return json(200, { token: 'mock-preview', expiresInSeconds: 900 });
      },
    ],
    [
      'PATCH',
      /^\/api\/v1\/admin\/testimonials\/([^/]+)\/status$/,
      ({ req, params, body }) => {
        const g = guard(req, 'inbox', { write: true });
        if (g.error) return g.error;
        const row = table('testimonials').find((r) => r.id === params[0]);
        if (!row) return problem(404, 'NOT_FOUND');
        if (!['pending', 'published', 'hidden'].includes(body?.status))
          return invalid('status', 'Invalid');
        Object.assign(row, { status: body.status, updatedAt: nowIso() });
        return json(200, row);
      },
    ],
    [
      'PATCH',
      /^\/api\/v1\/admin\/testimonials\/([^/]+)\/feature$/,
      ({ req, params, body }) => {
        const g = guard(req, 'inbox', { write: true });
        if (g.error) return g.error;
        const row = table('testimonials').find((r) => r.id === params[0]);
        if (!row) return problem(404, 'NOT_FOUND');
        if (typeof body?.isFeatured !== 'boolean') return invalid('isFeatured', 'Invalid');
        Object.assign(row, { isFeatured: body.isFeatured, updatedAt: nowIso() });
        return json(200, row);
      },
    ],

    // ---------- media ----------
    [
      'GET',
      /^\/api\/v1\/admin\/media$/,
      ({ req, query }) => {
        const g = guard(req, 'content');
        if (g.error) return g.error;
        const rows = [...db.media].sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt) || Number(b.id) - Number(a.id),
        );
        const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 20));
        const page = Math.max(1, Number(query.get('page')) || 1);
        return json(200, {
          data: rows.slice((page - 1) * limit, page * limit),
          total: rows.length,
          page,
          limit,
        });
      },
    ],
    [
      'POST',
      /^\/api\/v1\/admin\/media$/,
      ({ req, body }) => {
        const g = guard(req, 'content', { write: true });
        if (g.error) return g.error;
        const file = body?.file;
        if (!file || !file.size)
          return invalid('file', 'A file is required — send it as the multipart field "file"');
        const image = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type);
        if (!image && file.type !== 'application/pdf')
          return invalid('file', 'Unsupported file type');
        if (file.size > (image ? 5 : 10) * 1024 * 1024) return invalid('file', 'File too large');
        const at = nowIso();
        const id = nextId();
        const asset = {
          id,
          publicId: `00000000-0000-4000-8000-${id.padStart(12, '0')}`,
          kind: image ? 'image' : 'pdf',
          mimeType: file.type,
          sizeBytes: file.size,
          originalName: file.name,
          storageKey: `assets/mock/${id}`,
          checksumSha256: id.padStart(64, '0'),
          widthPx: image ? 1200 : null,
          heightPx: image ? 800 : null,
          altAr: null,
          altEn: null,
          uploadedBy: g.staff.id,
          createdAt: at,
          updatedAt: at,
        };
        db.media.push(asset);
        return json(201, asset);
      },
    ],
    [
      'PATCH',
      /^\/api\/v1\/admin\/media\/([^/]+)$/,
      ({ req, params, body }) => {
        const g = guard(req, 'content', { write: true });
        if (g.error) return g.error;
        const asset = db.media.find((a) => a.id === params[0]);
        if (!asset) return problem(404, 'NOT_FOUND');
        if (typeof body?.altAr !== 'string' || !body.altAr.trim() || body.altAr.length > 255)
          return invalid('altAr', 'Required');
        Object.assign(asset, { altAr: body.altAr, altEn: body.altEn ?? null, updatedAt: nowIso() });
        return json(200, asset);
      },
    ],
    [
      'DELETE',
      /^\/api\/v1\/admin\/media\/([^/]+)$/,
      ({ req, params }) => {
        const g = guard(req, 'content', { write: true });
        if (g.error) return g.error;
        const i = db.media.findIndex((a) => a.id === params[0]);
        if (i < 0) return problem(404, 'NOT_FOUND');
        const refs = [
          ['page-sections', 'imageAssetId', 'page_sections', (r) => r.headingAr ?? r.sectionKey],
          ['board', 'photoAssetId', 'board_members', (r) => r.nameAr],
          ['news', 'coverAssetId', 'posts', (r) => r.titleAr],
          ['partners', 'logoAssetId', 'partners', (r) => r.nameAr],
          ['documents', 'assetId', 'documents', (r) => r.titleAr],
        ];
        const usages = refs.flatMap(([endpoint, key, entity, label]) =>
          table(endpoint)
            .filter((r) => r[key] === params[0])
            .map((r) => ({ entity, id: r.id, label: label(r) })),
        );
        if (usages.length) return problem(409, 'ASSET_IN_USE', { usages });
        db.media.splice(i, 1);
        return json(200, { deleted: true });
      },
    ],
  );

  for (const [endpoint, spec] of Object.entries(KERNEL)) {
    const path = base(endpoint);
    const one = new RegExp(`^/api/v1/admin/${path}/([^/]+)$`);
    if (spec.sortable) {
      routes.push([
        'POST',
        new RegExp(`^/api/v1/admin/${path}/reorder$`),
        ({ req, body }) => {
          const g = guard(req, spec.area, { write: true });
          if (g.error) return g.error;
          if (!Array.isArray(body) || !body.length) return invalid('0', 'Expected array');
          for (const { id, sortOrder } of body) {
            const row = table(endpoint).find((r) => r.id === String(id));
            if (row) row.sortOrder = sortOrder;
          }
          return json(201, { reordered: body.length });
        },
      ]);
    }
    if (spec.publishable) {
      routes.push([
        'PATCH',
        new RegExp(`^/api/v1/admin/${path}/([^/]+)/publish$`),
        ({ req, params, body }) => {
          const g = guard(req, spec.area, { write: true });
          if (g.error) return g.error;
          const row = table(endpoint).find((r) => r.id === params[0]);
          if (!row) return problem(404, 'NOT_FOUND');
          const was = !!row.isPublished;
          row.isPublished = body?.isPublished ?? true;
          row.updatedAt = nowIso();
          onPublish(endpoint, row, was);
          return json(200, withWarnings(endpoint, row));
        },
      ]);
    }
    routes.push(
      [
        'GET',
        new RegExp(`^/api/v1/admin/${path}$`),
        ({ req, query }) => {
          const g = guard(req, spec.area);
          return g.error ?? json(200, listRows(endpoint, query));
        },
      ],
      [
        'POST',
        new RegExp(`^/api/v1/admin/${path}$`),
        ({ req, body }) => {
          const g = guard(req, spec.area, { write: true });
          if (g.error) return g.error;
          const bad = checkBody(endpoint, body, { create: true }) ?? conflict(endpoint, body, null);
          if (bad) return bad;
          const at = nowIso();
          const row = { id: nextId(), ...(spec.defaults ?? {}), ...body };
          if (spec.sortable && row.sortOrder === undefined) row.sortOrder = table(endpoint).length;
          if (spec.timestamps !== false) Object.assign(row, { createdAt: at, updatedAt: at });
          if (endpoint === 'news') {
            let slug = slugify(body.titleEn) || slugify(body.titleAr) || `post-${Date.now()}`;
            if (RESERVED_POST_SLUGS.has(slug)) slug = `${slug}-post`;
            const taken = new Set(table('news').map((p) => p.slug));
            for (let n = 2; taken.has(slug); n++) slug = `${slug.replace(/-\d+$/, '')}-${n}`;
            Object.assign(row, { slug, createdBy: g.staff.id });
            onPublish(endpoint, row, false);
          }
          table(endpoint).push(row);
          return json(201, withWarnings(endpoint, row));
        },
      ],
      [
        'GET',
        one,
        ({ req, params }) => {
          const g = guard(req, spec.area);
          if (g.error) return g.error;
          const row = table(endpoint).find((r) => r.id === params[0]);
          return row ? json(200, row) : problem(404, 'NOT_FOUND');
        },
      ],
      [
        'PATCH',
        one,
        ({ req, params, body }) => {
          const g = guard(req, spec.area, { write: true });
          if (g.error) return g.error;
          const row = table(endpoint).find((r) => r.id === params[0]);
          if (!row) return problem(404, 'NOT_FOUND');
          const bad =
            checkBody(endpoint, body, { create: false }) ?? conflict(endpoint, body, row.id);
          if (bad) return bad;
          if (
            endpoint === 'news' &&
            body.slug &&
            table('news').some((p) => p.id !== row.id && p.slug === body.slug)
          ) {
            return problem(409, 'SLUG_TAKEN');
          }
          const was = !!row.isPublished;
          Object.assign(row, body);
          if (spec.timestamps !== false) row.updatedAt = nowIso();
          onPublish(endpoint, row, was);
          return json(200, withWarnings(endpoint, row));
        },
      ],
      [
        'DELETE',
        one,
        ({ req, params }) => {
          const g = guard(req, spec.area, { write: true });
          if (g.error) return g.error;
          const i = table(endpoint).findIndex((r) => r.id === params[0]);
          if (i < 0) return problem(404, 'NOT_FOUND');
          for (const [other, key] of spec.usedBy ?? []) {
            if (table(other).some((r) => r[key] === params[0]))
              return problem(409, 'RESOURCE_IN_USE');
          }
          table(endpoint).splice(i, 1);
          if (endpoint === 'work-areas')
            db.content['work-area-items'] = table('work-area-items').filter(
              (r) => r.workAreaId !== params[0],
            );
          if (endpoint === 'pages')
            db.content['page-sections'] = table('page-sections').filter(
              (r) => r.pageId !== params[0],
            );
          return json(200, { deleted: true });
        },
      ],
    );
  }
  return routes;
}
