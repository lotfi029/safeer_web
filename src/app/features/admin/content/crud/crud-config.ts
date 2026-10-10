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
  | 'media';

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
      model[k] = v === null || v === undefined ? (f.type === 'boolean' ? false : '') : v;
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
      if (f.type === 'number') {
        if (raw !== '' && raw !== null && raw !== undefined) body[k] = Number(raw);
        return;
      }
      const text =
        typeof raw === 'string' ? raw.trim() : raw === null || raw === undefined ? '' : String(raw);
      const optionalEn = f.bilingual && i === 1;
      if (text) {
        body[k] = text;
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
