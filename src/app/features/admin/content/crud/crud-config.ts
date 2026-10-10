import type { ContentRow } from '../../../../core/api/admin/content-api';
import type { StaffArea } from '../../../../core/auth/role-matrix';

export type CrudFieldType =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'digits'
  | 'number'
  | 'boolean'
  | 'select'
  | 'date'
  | 'url'
  | 'slug'
  | 'media'
  /** Riyadh wall-clock time in the form; an ISO instant with `+03:00` in the body. */
  | 'datetime';

/**
 * One form field of a collection. `bilingual` expands `key` into `keyAr` (required when `required`)
 * and `keyEn` (always optional, sent as null when empty), the API's pairs.
 */
export interface CrudField {
  key: string;
  type: CrudFieldType;
  /** i18n key of the label (under `admin.content.fields`). */
  label: string;
  bilingual?: boolean;
  required?: boolean;
  max?: number;
  /** `select`: fixed values (labels at `admin.content.options.<key>.<value>`). */
  options?: readonly string[];
  /** `select`: options from another collection. */
  optionsFrom?: { endpoint: string; label: (row: ContentRow) => string };
  /** `media`: which kind of asset may be picked. */
  media?: 'image' | 'pdf';
  /** Only sent on create (e.g. a page slug, which update rejects). */
  createOnly?: boolean;
  /** Set from the page context (parent id, current tab) and not shown. */
  hidden?: boolean;
  /** Visible hint (i18n key). */
  hint?: string;
  /** Empty values are sent as `null` (nullable columns) instead of being left out. */
  nullable?: boolean;
  defaultValue?: unknown;
  /** `select`: send the value as a number (`statusCode` 301/302). */
  asNumber?: boolean;
  /** Must be later than this other field (`endsAt` after `startsAt`). */
  after?: string;
}

export interface CrudTabs {
  /** Query filter and form field it sets (`grp`, `kind`, `category`, `categoryId`). */
  param: string;
  values: readonly string[];
  /** i18n key prefix of the tab labels. */
  label: string;
}

export interface CrudConfig {
  /** Route + i18n id (`admin.content.<id>.*`). */
  id: string;
  endpoint: string;
  area: StaffArea;
  /**
   * How visibility changes: `route` = `PATCH :id/publish`, `field` = `PATCH :id {isPublished}`
   * (collections with the column but no publish route), `status` = testimonials' status routes.
   */
  publish?: 'route' | 'field' | 'status';
  sortable?: boolean;
  searchable?: boolean;
  fields: readonly CrudField[];
  /** The row's title and subtitle in the list. */
  primary: (row: ContentRow, lang: 'ar' | 'en') => string;
  secondary?: (row: ContentRow, lang: 'ar' | 'en', t: (key: string) => string) => string;
  /** Field holding an image asset id to show as the row thumbnail. */
  thumb?: string;
  tabs?: CrudTabs;
  /** A per-row link to a dedicated screen (a page's sections): label key + path under /admin. */
  link?: { label: string; path: (row: ContentRow) => string };
  /** Child collection shown under each row (work-area items). */
  children?: { config: CrudConfig; parentKey: string };
  /** Area for delete buttons when it differs from `area` (`redirects.delete`). */
  deleteArea?: StaffArea;
  /** A problem code (and title) → the field its message belongs next to. */
  errorField?: (code: string, title: string) => string | null;
}

/** `titleAr`/`titleEn` → the value for the UI language, falling back to Arabic. */
export function pick(row: ContentRow, key: string, lang: 'ar' | 'en'): string {
  const ar = row[`${key}Ar`];
  const en = row[`${key}En`];
  const value = lang === 'en' && typeof en === 'string' && en.trim() ? en : ar;
  return typeof value === 'string' ? value : '';
}

/** The keys a field writes to (`titleAr`/`titleEn` for bilingual fields). */
export function fieldKeys(field: CrudField): string[] {
  return field.bilingual ? [`${field.key}Ar`, `${field.key}En`] : [field.key];
}

/** Empty form model for a collection (defaults, then fixed context values). */
export function emptyModel(
  fields: readonly CrudField[],
  context: Record<string, unknown> = {},
): Record<string, unknown> {
  const model: Record<string, unknown> = {};
  for (const f of fields) {
    for (const k of fieldKeys(f)) {
      model[k] = f.defaultValue ?? (f.type === 'boolean' ? false : '');
    }
  }
  return { ...model, ...context };
}

/** Form model from a row (null → ''), so inputs stay controlled. */
export function modelFromRow(
  fields: readonly CrudField[],
  row: ContentRow,
): Record<string, unknown> {
  const model: Record<string, unknown> = {};
  for (const f of fields) {
    for (const k of fieldKeys(f)) {
      const v = row[k];
      model[k] =
        v === null || v === undefined
          ? f.type === 'boolean'
            ? false
            : ''
          : f.type === 'datetime'
            ? toRiyadhInput(String(v))
            : v;
    }
  }
  return model;
}

/**
 * The request body: trims text, sends nullable/optional empties as `null` (or leaves them out on
 * create), converts numbers, and drops create-only keys on update.
 */
export function toBody(
  fields: readonly CrudField[],
  model: Record<string, unknown>,
  mode: 'create' | 'update',
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.createOnly && mode === 'update') continue;
    fieldKeys(f).forEach((k, i) => {
      const raw = model[k];
      if (f.type === 'boolean') {
        body[k] = !!raw;
        return;
      }
      if (f.type === 'datetime') {
        if (typeof raw === 'string' && raw) body[k] = fromRiyadhInput(raw);
        return;
      }
      if (f.type === 'number') {
        if (raw !== '' && raw !== null && raw !== undefined) body[k] = Number(raw);
        else if (f.nullable) body[k] = null;
        return;
      }
      const text =
        typeof raw === 'string' ? raw.trim() : raw === null || raw === undefined ? '' : String(raw);
      const optionalEn = f.bilingual && i === 1;
      if (text) {
        body[k] = f.asNumber ? Number(text) : text;
      } else if (f.nullable || optionalEn || (f.type === 'media' && mode === 'update')) {
        body[k] = null;
      }
    });
  }
  return body;
}

/** Client-side checks mirroring the DTOs: required (Arabic side) and max lengths. */
export function validate(
  fields: readonly CrudField[],
  model: Record<string, unknown>,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const f of fields) {
    if (f.hidden) continue;
    fieldKeys(f).forEach((k, i) => {
      const v = model[k];
      const text = typeof v === 'string' ? v.trim() : v;
      if (f.required && i === 0 && (text === '' || text === null || text === undefined)) {
        (errors[k] ??= []).push('required');
      }
      if (f.max && typeof text === 'string' && text.length > f.max) {
        (errors[k] ??= []).push('maxLength');
      }
      if (f.type === 'digits' && typeof text === 'string' && text && !/^\d+$/.test(text)) {
        (errors[k] ??= []).push('pattern');
      }
      if (f.after && typeof text === 'string' && text) {
        const other = model[f.after];
        if (typeof other === 'string' && other && text <= other) (errors[k] ??= []).push('after');
      }
      if (
        f.type === 'slug' &&
        typeof text === 'string' &&
        text &&
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)
      ) {
        (errors[k] ??= []).push('slug');
      }
    });
  }
  return errors;
}

/** Saudi Arabia keeps UTC+3 all year (no DST), so Riyadh time is a fixed offset. */
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/** ISO instant → `YYYY-MM-DDTHH:mm` in Riyadh time (a datetime-local value). */
export function toRiyadhInput(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : new Date(t + RIYADH_OFFSET_MS).toISOString().slice(0, 16);
}

/** `YYYY-MM-DDTHH:mm` (Riyadh) → ISO with offset, as the API's `z.iso.datetime({ offset: true })` wants. */
export function fromRiyadhInput(value: string): string {
  return (value.length === 16 ? value + ':00' : value) + '+03:00';
}
