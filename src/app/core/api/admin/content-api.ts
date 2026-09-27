import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../../config/api-base-url';
import type { Id, Paged } from '../models';
import { queryParams } from './admin-api';

const A = `${API_PREFIX}/admin`;
const enc = encodeURIComponent;

/** Any admin content row: raw bilingual fields (`titleAr`/`titleEn`, …), never collapsed. */
export type ContentRow = { id: Id } & Record<string, unknown>;

export interface ContentQuery {
  page?: number;
  limit?: number;
  q?: string | null;
  /** `true`/`false` on publishable collections. */
  published?: boolean | null;
  /** Exact-match filters on entity columns (`pageId`, `grp`, `kind`, …). Booleans as `1`/`0`. */
  [filter: string]: string | number | boolean | null | undefined;
}

/** A news row after create/update/publish: `warnings` holds `COVER_MISSING` (non-blocking). */
export type WithWarnings<T> = T & { warnings?: string[] };

export interface MediaAsset {
  id: Id;
  publicId: string;
  kind: 'image' | 'pdf';
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  widthPx: number | null;
  heightPx: number | null;
  altAr: string | null;
  altEn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetUsage {
  entity: 'page_sections' | 'board_members' | 'posts' | 'partners' | 'documents' | string;
  id: Id;
  label: string;
}

/** `/files/:publicId[/variant]` (outside /api/v1); variants are WebP, images only. */
export function mediaUrl(
  asset: Pick<MediaAsset, 'publicId' | 'kind'>,
  variant: 'thumb' | 'card' | 'full' | null = 'thumb',
): string {
  return asset.kind === 'image' && variant
    ? `/files/${asset.publicId}/${variant}`
    : `/files/${asset.publicId}`;
}

/**
 * The CRUD kernel every content collection shares (safeer_api common/crud/crud.factory.ts):
 * list/get/create/update/delete, `PATCH :id/publish` on publishable collections and
 * `POST reorder` (a bare array) on sortable ones.
 */
@Injectable({ providedIn: 'root' })
export class ContentApi {
  private readonly http = inject(HttpClient);

  list<T extends ContentRow = ContentRow>(
    endpoint: string,
    query: ContentQuery = {},
  ): Observable<Paged<T>> {
    return this.http.get<Paged<T>>(`${A}/${endpoint}`, { params: queryParams(query) });
  }

  get<T extends ContentRow = ContentRow>(endpoint: string, id: Id): Observable<T> {
    return this.http.get<T>(`${A}/${endpoint}/${enc(id)}`);
  }

  create<T extends ContentRow = ContentRow>(
    endpoint: string,
    body: object,
  ): Observable<WithWarnings<T>> {
    return this.http.post<WithWarnings<T>>(`${A}/${endpoint}`, body);
  }

  update<T extends ContentRow = ContentRow>(
    endpoint: string,
    id: Id,
    body: object,
  ): Observable<WithWarnings<T>> {
    return this.http.patch<WithWarnings<T>>(`${A}/${endpoint}/${enc(id)}`, body);
  }

  remove(endpoint: string, id: Id): Observable<{ deleted: true }> {
    return this.http.delete<{ deleted: true }>(`${A}/${endpoint}/${enc(id)}`);
  }

  publish<T extends ContentRow = ContentRow>(
    endpoint: string,
    id: Id,
    isPublished: boolean,
  ): Observable<WithWarnings<T>> {
    return this.http.patch<WithWarnings<T>>(`${A}/${endpoint}/${enc(id)}/publish`, { isPublished });
  }

  reorder(
    endpoint: string,
    items: { id: Id; sortOrder: number }[],
  ): Observable<{ reordered: number }> {
    return this.http.post<{ reordered: number }>(`${A}/${endpoint}/reorder`, items);
  }

  /** Testimonials: `PATCH :id/status` and `:id/feature`. */
  testimonialStatus(id: Id, status: 'pending' | 'published' | 'hidden'): Observable<ContentRow> {
    return this.http.patch<ContentRow>(`${A}/testimonials/${enc(id)}/status`, { status });
  }

  testimonialFeature(id: Id, isFeatured: boolean): Observable<ContentRow> {
    return this.http.patch<ContentRow>(`${A}/testimonials/${enc(id)}/feature`, { isFeatured });
  }

  /** Deletes every `isLegacy` post; `{ deleted: n }`. */
  deleteLegacyNews(): Observable<{ deleted: number }> {
    return this.http.delete<{ deleted: number }>(`${A}/news/legacy`);
  }

  /** A 15-minute bearer token for `/news/<slug>?preview=<token>` (posts only). */
  previewToken(postId: Id): Observable<{ token: string; expiresInSeconds: number }> {
    return this.http.get<{ token: string; expiresInSeconds: number }>(`${A}/preview-token`, {
      params: queryParams({ collection: 'posts', id: postId }),
    });
  }

  // ---------- media ----------

  media(query: { page?: number; limit?: number } = {}): Observable<Paged<MediaAsset>> {
    return this.http.get<Paged<MediaAsset>>(`${A}/media`, { params: queryParams(query) });
  }

  /** Multipart field `file`; 201 new, or 200 with the existing asset when the checksum matches. */
  upload(file: File): Observable<MediaAsset> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<MediaAsset>(`${A}/media`, form);
  }

  setAlt(id: Id, altAr: string, altEn: string | null): Observable<MediaAsset> {
    return this.http.patch<MediaAsset>(`${A}/media/${enc(id)}`, { altAr, altEn });
  }

  deleteMedia(id: Id): Observable<{ deleted: true }> {
    return this.http.delete<{ deleted: true }>(`${A}/media/${enc(id)}`);
  }
}
