import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_PREFIX } from '../../config/api-base-url';
import type {
  AdminApplicationDocument,
  AdminOverview,
  ApplicationStatus,
  DocType,
  Id,
  Paged,
} from '../models';
import type {
  AdminApplicationCounts,
  AdminApplicationDetail,
  AdminApplicationListItem,
  AdminApplicationNote,
  AdminApplicationQuery,
  AdminAssignee,
  AdminMessage,
  AdminMessagePage,
  AdminMessageReply,
  AdminTestimonial,
  BulkActionBody,
  BulkActionResult,
  ConvertToTestimonialBody,
  CsvExport,
  MessageStatus,
} from './admin-models';

const A = `${API_PREFIX}/admin`;
const enc = encodeURIComponent;

/** Drops empty values so the API sees only the filters actually set. */
export function queryParams(
  query: Record<string, string | number | boolean | null | undefined>,
): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

/** Filename from `Content-Disposition: attachment; filename="x.csv"`. */
export function attachmentName(res: HttpResponse<unknown>, fallback: string): string {
  const header = res.headers.get('content-disposition') ?? '';
  return /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)?.[1] ?? fallback;
}

/**
 * The URL of a document file for an `<a>`/viewer. `downloadPath` is relative to the API base
 * (`admin/applications/{id}/documents/{docId}/file`) and is `null` for a superseded document, whose
 * file no longer exists: the caller must not render a link then (A11).
 */
export function documentUrl(doc: Pick<AdminApplicationDocument, 'downloadPath'>): string | null {
  return doc.downloadPath ? `${API_PREFIX}/${doc.downloadPath.replace(/^\/+/, '')}` : null;
}

/** Admin overview, applications and messages (Stage 2, Phase 7). Cookie session + CSRF via interceptors. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  overview(): Observable<AdminOverview> {
    return this.http.get<AdminOverview>(`${A}/overview`);
  }

  // ---------- applications ----------

  applications(query: AdminApplicationQuery): Observable<Paged<AdminApplicationListItem>> {
    return this.http.get<Paged<AdminApplicationListItem>>(`${A}/applications`, {
      params: queryParams({ ...query }),
    });
  }

  applicationCounts(): Observable<AdminApplicationCounts> {
    return this.http.get<AdminApplicationCounts>(`${A}/applications/counts`);
  }

  assignees(): Observable<AdminAssignee[]> {
    return this.http.get<AdminAssignee[]>(`${A}/applications/assignees`);
  }

  exportApplications(query: Omit<AdminApplicationQuery, 'page' | 'limit'>): Observable<CsvExport> {
    return this.http
      .get(`${A}/applications/export.csv`, {
        params: queryParams({ ...query }),
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((res) => ({
          blob: res.body ?? new Blob([]),
          filename: attachmentName(res, 'applications.csv'),
          truncated: res.headers.get('x-truncated') === 'true',
        })),
      );
  }

  bulk(body: BulkActionBody): Observable<BulkActionResult[]> {
    return this.http.post<BulkActionResult[]>(`${A}/applications/bulk`, body);
  }

  application(id: Id): Observable<AdminApplicationDetail> {
    return this.http.get<AdminApplicationDetail>(`${A}/applications/${enc(id)}`);
  }

  updateApplication(
    id: Id,
    body: { status?: ApplicationStatus; assignedReviewerId?: Id | null },
  ): Observable<AdminApplicationDetail> {
    return this.http.patch<AdminApplicationDetail>(`${A}/applications/${enc(id)}`, body);
  }

  requestDocuments(
    id: Id,
    body: { docTypes: DocType[]; message?: string },
  ): Observable<AdminApplicationDetail> {
    return this.http.post<AdminApplicationDetail>(
      `${A}/applications/${enc(id)}/request-documents`,
      body,
    );
  }

  reviewDocument(
    id: Id,
    docId: Id,
    body: { status: 'accepted' | 'rejected'; reason?: string },
  ): Observable<AdminApplicationDocument> {
    return this.http.patch<AdminApplicationDocument>(
      `${A}/applications/${enc(id)}/documents/${enc(docId)}`,
      body,
    );
  }

  addNote(id: Id, body: string): Observable<AdminApplicationNote> {
    return this.http.post<AdminApplicationNote>(`${A}/applications/${enc(id)}/notes`, { body });
  }

  // ---------- messages ----------

  messages(query: {
    status?: MessageStatus | null;
    page?: number;
    limit?: number;
  }): Observable<AdminMessagePage> {
    return this.http.get<AdminMessagePage>(`${A}/messages`, { params: queryParams(query) });
  }

  message(id: Id): Observable<AdminMessage> {
    return this.http.get<AdminMessage>(`${A}/messages/${enc(id)}`);
  }

  reply(id: Id, body: string): Observable<{ message: AdminMessage; reply: AdminMessageReply }> {
    return this.http.post<{ message: AdminMessage; reply: AdminMessageReply }>(
      `${A}/messages/${enc(id)}/reply`,
      { body },
    );
  }

  setMessageStatus(id: Id, status: MessageStatus): Observable<AdminMessage> {
    return this.http.patch<AdminMessage>(`${A}/messages/${enc(id)}`, { status });
  }

  convertToTestimonial(id: Id, body: ConvertToTestimonialBody): Observable<AdminTestimonial> {
    return this.http.post<AdminTestimonial>(
      `${A}/messages/${enc(id)}/convert-to-testimonial`,
      body,
    );
  }

  deleteMessage(id: Id): Observable<{ deleted: true }> {
    return this.http.delete<{ deleted: true }>(`${A}/messages/${enc(id)}`);
  }
}

/** Saves a downloaded blob through a temporary object URL (browser only). */
export function saveBlob(doc: Document, blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
