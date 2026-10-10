import type { ContentRow } from '../../../../core/api/admin/content-api';
import { type CrudConfig, pick } from './crud-config';

const bool = (row: ContentRow, key: string) => row[key] === true;

/** Work-area items (B11: each item has its own visibility toggle). Shown under their area. */
export const WORK_AREA_ITEMS: CrudConfig = {
  id: 'workAreaItems',
  endpoint: 'work-area-items',
  area: 'content',
  publish: 'route',
  sortable: true,
  fields: [
    { key: 'workAreaId', type: 'text', label: 'workArea', hidden: true },
    { key: 'text', type: 'text', label: 'text', bilingual: true, required: true, max: 255 },
  ],
  primary: (r, l) => pick(r, 'text', l),
};

/**
 * The config-driven collections of the content area (and the inbox's testimonials and themes).
 * Pages and news are hand-built screens; everything here uses CrudPage.
 */
export const COLLECTIONS: Record<string, CrudConfig> = {
  workAreas: {
    id: 'workAreas',
    endpoint: 'work-areas',
    area: 'content',
    publish: 'route',
    sortable: true,
    fields: [
      { key: 'title', type: 'text', label: 'title', bilingual: true, required: true, max: 191 },
      { key: 'icon', type: 'text', label: 'icon', max: 64, nullable: true, hint: 'iconHint' },
    ],
    primary: (r, l) => pick(r, 'title', l),
    children: { config: WORK_AREA_ITEMS, parentKey: 'workAreaId' },
  },
  board: {
    id: 'board',
    endpoint: 'board',
    area: 'content',
    publish: 'route',
    sortable: true,
    searchable: true,
    tabs: { param: 'grp', values: ['board', 'executive'], label: 'admin.content.options.grp' },
    fields: [
      { key: 'grp', type: 'select', label: 'grp', options: ['board', 'executive'], hidden: true },
      { key: 'name', type: 'text', label: 'name', bilingual: true, required: true, max: 191 },
      { key: 'role', type: 'text', label: 'role', bilingual: true, required: true, max: 120 },
      { key: 'isLead', type: 'boolean', label: 'isLead' },
      { key: 'bio', type: 'textarea', label: 'bio', bilingual: true, max: 5000, nullable: true },
      { key: 'photoAssetId', type: 'media', label: 'photo', media: 'image', nullable: true },
    ],
    primary: (r, l) => pick(r, 'name', l),
    secondary: (r, l, t) =>
      [pick(r, 'role', l), bool(r, 'isLead') ? t('admin.content.fields.isLead') : '']
        .filter(Boolean)
        .join(' · '),
    thumb: 'photoAssetId',
  },
  testimonials: {
    id: 'testimonials',
    endpoint: 'testimonials',
    area: 'inbox',
    publish: 'status',
    sortable: true,
    searchable: true,
    tabs: {
      param: 'status',
      values: ['pending', 'published', 'hidden'],
      label: 'admin.content.options.status',
    },
    fields: [
      { key: 'quote', type: 'textarea', label: 'quote', bilingual: true, required: true },
      { key: 'authorName', type: 'text', label: 'authorName', required: true, max: 191 },
      {
        key: 'authorDesc',
        type: 'text',
        label: 'authorDesc',
        bilingual: true,
        max: 255,
        nullable: true,
      },
      { key: 'isFeatured', type: 'boolean', label: 'isFeatured' },
    ],
    primary: (r, l) => pick(r, 'quote', l),
    secondary: (r, l, t) =>
      [
        String(r['authorName'] ?? ''),
        r['source'] === 'contact_form' ? t('admin.content.testimonials.fromContact') : '',
        bool(r, 'isFeatured') ? t('admin.content.fields.isFeatured') : '',
      ]
        .filter(Boolean)
        .join(' · '),
  },
  themes: {
    id: 'themes',
    endpoint: 'testimonial-themes',
    area: 'inbox',
    sortable: true,
    fields: [
      { key: 'title', type: 'text', label: 'title', bilingual: true, required: true, max: 191 },
      {
        key: 'description',
        type: 'textarea',
        label: 'description',
        bilingual: true,
        nullable: true,
      },
      { key: 'isImprovement', type: 'boolean', label: 'isImprovement' },
    ],
    primary: (r, l) => pick(r, 'title', l),
    secondary: (r, _l, t) =>
      bool(r, 'isImprovement') ? t('admin.content.fields.isImprovement') : '',
  },
  partners: {
    id: 'partners',
    endpoint: 'partners',
    area: 'content',
    publish: 'route',
    sortable: true,
    searchable: true,
    tabs: {
      param: 'category',
      values: ['government', 'university', 'association', 'supporter'],
      label: 'admin.content.options.category',
    },
    fields: [
      {
        key: 'category',
        type: 'select',
        label: 'category',
        options: ['government', 'university', 'association', 'supporter'],
        required: true,
      },
      { key: 'name', type: 'text', label: 'name', bilingual: true, required: true, max: 191 },
      { key: 'url', type: 'url', label: 'url', max: 255, nullable: true, hint: 'urlHint' },
      { key: 'logoAssetId', type: 'media', label: 'logo', media: 'image', nullable: true },
    ],
    primary: (r, l) => pick(r, 'name', l),
    secondary: (r, _l, t) => t(`admin.content.options.category.${String(r['category'])}`),
    thumb: 'logoAssetId',
  },
  docCategories: {
    id: 'docCategories',
    endpoint: 'doc-categories',
    area: 'content',
    publish: 'field',
    sortable: true,
    fields: [
      { key: 'slug', type: 'slug', label: 'slug', required: true, max: 64 },
      { key: 'name', type: 'text', label: 'name', bilingual: true, required: true, max: 191 },
    ],
    primary: (r, l) => pick(r, 'name', l),
    secondary: (r) => String(r['slug'] ?? ''),
  },
  documents: {
    id: 'documents',
    endpoint: 'documents',
    area: 'content',
    publish: 'route',
    searchable: true,
    fields: [
      {
        key: 'categoryId',
        type: 'select',
        label: 'docCategory',
        required: true,
        optionsFrom: { endpoint: 'doc-categories', label: (r) => pick(r, 'name', 'ar') },
      },
      { key: 'title', type: 'text', label: 'title', bilingual: true, required: true, max: 255 },
      {
        key: 'assetId',
        type: 'media',
        label: 'file',
        media: 'pdf',
        nullable: true,
        hint: 'fileHint',
      },
      { key: 'docDate', type: 'date', label: 'docDate', nullable: true },
    ],
    primary: (r, l) => pick(r, 'title', l),
    secondary: (r) => String(r['docDate'] ?? ''),
  },
  stats: {
    id: 'stats',
    endpoint: 'stats',
    area: 'content',
    publish: 'route',
    sortable: true,
    fields: [
      { key: 'value', type: 'digits', label: 'value', nullable: true, hint: 'valueHint' },
      { key: 'label', type: 'text', label: 'label', bilingual: true, required: true, max: 120 },
      { key: 'sub', type: 'text', label: 'sub', bilingual: true, max: 191, nullable: true },
    ],
    primary: (r, l) => pick(r, 'label', l),
    secondary: (r) => String(r['value'] ?? '—'),
  },
  aboutItems: {
    id: 'aboutItems',
    endpoint: 'about-items',
    area: 'content',
    publish: 'route',
    sortable: true,
    tabs: {
      param: 'kind',
      values: ['vision', 'mission', 'goal', 'care_pillar', 'scholarship_step', 'requirement'],
      label: 'admin.content.options.kind',
    },
    fields: [
      {
        key: 'kind',
        type: 'select',
        label: 'kind',
        options: ['vision', 'mission', 'goal', 'care_pillar', 'scholarship_step', 'requirement'],
        hidden: true,
      },
      { key: 'title', type: 'text', label: 'title', bilingual: true, required: true, max: 191 },
      { key: 'icon', type: 'text', label: 'icon', max: 64, nullable: true, hint: 'iconHint' },
      { key: 'body', type: 'markdown', label: 'body', bilingual: true, nullable: true },
    ],
    primary: (r, l) => pick(r, 'title', l),
  },
  pages: {
    id: 'pages',
    endpoint: 'pages',
    area: 'content',
    publish: 'route',
    searchable: true,
    fields: [
      { key: 'slug', type: 'slug', label: 'slug', required: true, max: 180, createOnly: true },
      { key: 'title', type: 'text', label: 'title', bilingual: true, required: true, max: 191 },
      {
        key: 'metaTitle',
        type: 'text',
        label: 'metaTitle',
        bilingual: true,
        max: 191,
        nullable: true,
      },
      {
        key: 'metaDescription',
        type: 'textarea',
        label: 'metaDescription',
        bilingual: true,
        max: 500,
        nullable: true,
      },
      { key: 'needsReview', type: 'boolean', label: 'needsReview' },
    ],
    primary: (r, l) => pick(r, 'title', l),
    secondary: (r, _l, t) =>
      [
        `/${String(r['slug'] ?? '')}`,
        typeof r['sectionsCount'] === 'number'
          ? `${t('admin.content.pages.sections')}: ${r['sectionsCount']}`
          : '',
        r['needsReview'] === true ? t('admin.content.fields.needsReview') : '',
      ]
        .filter(Boolean)
        .join(' · '),
    link: { label: 'admin.content.pages.editSections', path: (r) => `pages/${r.id}` },
  },
  pageSections: {
    id: 'pageSections',
    endpoint: 'page-sections',
    area: 'content',
    publish: 'route',
    sortable: true,
    fields: [
      { key: 'pageId', type: 'text', label: 'page', hidden: true },
      {
        key: 'sectionKey',
        type: 'slug',
        label: 'sectionKey',
        required: true,
        max: 64,
        hint: 'sectionKeyHint',
      },
      {
        key: 'label',
        type: 'text',
        label: 'sectionLabel',
        bilingual: true,
        max: 191,
        nullable: true,
      },
      { key: 'heading', type: 'text', label: 'heading', bilingual: true, max: 255, nullable: true },
      { key: 'body', type: 'markdown', label: 'body', bilingual: true, nullable: true },
      {
        key: 'primaryButtonLabel',
        type: 'text',
        label: 'primaryButtonLabel',
        bilingual: true,
        max: 120,
        nullable: true,
      },
      {
        key: 'primaryButtonUrl',
        type: 'url',
        label: 'primaryButtonUrl',
        max: 255,
        nullable: true,
        hint: 'buttonUrlHint',
      },
      {
        key: 'secondaryButtonLabel',
        type: 'text',
        label: 'secondaryButtonLabel',
        bilingual: true,
        max: 120,
        nullable: true,
      },
      {
        key: 'secondaryButtonUrl',
        type: 'url',
        label: 'secondaryButtonUrl',
        max: 255,
        nullable: true,
        hint: 'buttonUrlHint',
      },
      { key: 'imageAssetId', type: 'media', label: 'image', media: 'image', nullable: true },
    ],
    primary: (r, l) =>
      pick(r, 'heading', l) || pick(r, 'label', l) || String(r['sectionKey'] ?? ''),
    secondary: (r, l) =>
      [String(r['sectionKey'] ?? ''), pick(r, 'label', l)].filter(Boolean).join(' · '),
    thumb: 'imageAssetId',
  },
  /** Redirects (content; delete is admin-only). Chains and duplicates come back as REDIRECT_CHAIN. */
  redirects: {
    id: 'redirects',
    endpoint: 'redirects',
    area: 'content',
    deleteArea: 'redirects.delete',
    searchable: true,
    fields: [
      {
        key: 'fromPath',
        type: 'url',
        label: 'fromPath',
        required: true,
        max: 255,
        hint: 'pathHint',
      },
      { key: 'toPath', type: 'url', label: 'toPath', required: true, max: 255, hint: 'pathHint' },
      {
        key: 'statusCode',
        type: 'select',
        label: 'statusCode',
        options: ['301', '302'],
        asNumber: true,
        required: true,
        defaultValue: '301',
      },
    ],
    primary: (r) => `${String(r['fromPath'])} → ${String(r['toPath'])}`,
    secondary: (r, _l, t) =>
      `${String(r['statusCode'])} · ${t('admin.content.redirects.hits')}: ${String(r['hits'] ?? 0)}`,
    // "A redirect from … already exists" is about the source; a chain is about the target.
    errorField: (code, title) =>
      code === 'REDIRECT_CHAIN' ? (/already exists/i.test(title) ? 'fromPath' : 'toPath') : null,
  },
  /** Interview slots (applications area). Editing a booked slot notifies the applicant. */
  interviewSlots: {
    id: 'interviewSlots',
    endpoint: 'interview-slots',
    area: 'applications',
    fields: [
      { key: 'startsAt', type: 'datetime', label: 'startsAt', required: true, hint: 'riyadhTime' },
      {
        key: 'endsAt',
        type: 'datetime',
        label: 'endsAt',
        required: true,
        after: 'startsAt',
        hint: 'riyadhTime',
      },
      {
        key: 'location',
        type: 'text',
        label: 'location',
        bilingual: true,
        max: 255,
        nullable: true,
      },
    ],
    primary: (r, l) => slotLabel(String(r['startsAt']), String(r['endsAt']), l),
    secondary: (r, l, t) =>
      [
        pick(r, 'location', l),
        r['applicationId']
          ? t('admin.content.interviewSlots.booked')
          : t('admin.content.interviewSlots.free'),
      ]
        .filter(Boolean)
        .join(' · '),
  },
  /** Only its fields are used (the news screens are hand-built); slug is edited separately. */
  news: {
    id: 'news',
    endpoint: 'news',
    area: 'content',
    publish: 'route',
    fields: [
      { key: 'title', type: 'text', label: 'title', bilingual: true, required: true, max: 191 },
      {
        key: 'categoryId',
        type: 'select',
        label: 'newsCategory',
        required: true,
        optionsFrom: { endpoint: 'news-categories', label: (r) => pick(r, 'name', 'ar') },
      },
      {
        key: 'publishedOn',
        type: 'date',
        label: 'publishedOn',
        nullable: true,
        hint: 'publishedOnHint',
      },
      { key: 'excerpt', type: 'textarea', label: 'excerpt', bilingual: true, nullable: true },
      { key: 'body', type: 'markdown', label: 'body', bilingual: true, nullable: true },
      {
        key: 'coverAssetId',
        type: 'media',
        label: 'cover',
        media: 'image',
        nullable: true,
        hint: 'coverHint',
      },
      { key: 'isFeatured', type: 'boolean', label: 'isFeatured' },
      { key: 'isLegacy', type: 'boolean', label: 'isLegacy' },
    ],
    primary: (r, l) => pick(r, 'title', l),
    thumb: 'coverAssetId',
  },
  newsCategories: {
    id: 'newsCategories',
    endpoint: 'news-categories',
    area: 'content',
    sortable: true,
    fields: [
      { key: 'slug', type: 'slug', label: 'slug', required: true, max: 180 },
      { key: 'name', type: 'text', label: 'name', bilingual: true, required: true, max: 191 },
    ],
    primary: (r, l) => pick(r, 'name', l),
    secondary: (r) => String(r['slug'] ?? ''),
  },
};

/** `Sun, 12 Oct 2026, 10:00–10:30` in Riyadh time (Gregorian; Arabic-Indic digits in Arabic). */
export function slotLabel(startsAt: string, endsAt: string, lang: 'ar' | 'en' = 'en'): string {
  const locale = lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-arab' : 'en-GB';
  const opts = {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  } as const;
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Riyadh',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(startsAt));
  const from = new Intl.DateTimeFormat(locale, opts).format(new Date(startsAt));
  const to = new Intl.DateTimeFormat(locale, opts).format(new Date(endsAt));
  return `${day}, ${from}–${to}`;
}
