import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../../config/api-base-url';
import type { AdminOverview, Id } from '../models';
import type {
  AdminMessage,
  AdminMessagePage,
  AdminMessageReply,
  AdminTestimonial,
  ConvertToTestimonialBody,
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

/** Admin overview and messages (Stage 2, Phase 7). Cookie session + CSRF via interceptors. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  overview(): Observable<AdminOverview> {
    return this.http.get<AdminOverview>(`${A}/overview`);
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
