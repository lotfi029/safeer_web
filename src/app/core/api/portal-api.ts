import { HttpClient, HttpEvent } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../config/api-base-url';
import type {
  ApplicantDocument,
  ApplicationCorrections,
  ApplicationPatch,
  ApplicationStep1,
  CorrectApplicationResponse,
  CreateApplicationResponse,
  DocType,
  InterviewBooking,
  InterviewSlot,
  OkResponse,
  OtpChannel,
  Paged,
  PatchApplicationResponse,
  PortalDocumentsResponse,
  PortalEvent,
  PortalMe,
  RequestOtpResponse,
  SubmitApplicationResponse,
} from './models';

/** Apply flow + student portal endpoints (applicant cookie `sf_app_sid`, CSRF via interceptor). */
@Injectable({ providedIn: 'root' })
export class PortalApi {
  private readonly http = inject(HttpClient);

  createApplication(body: ApplicationStep1): Observable<CreateApplicationResponse> {
    return this.http.post<CreateApplicationResponse>(`${API_PREFIX}/applications`, body);
  }

  me(): Observable<PortalMe> {
    return this.http.get<PortalMe>(`${API_PREFIX}/portal/me`);
  }

  /** C15: `draft` only; any other status answers 409 `APPLICATION_LOCKED` (use `correct()` in docs_missing). */
  patch(body: ApplicationPatch): Observable<PatchApplicationResponse> {
    return this.http.patch<PatchApplicationResponse>(`${API_PREFIX}/portal/application`, body);
  }

  /** C15: `docs_missing` only. Records an `APPLICANT_CORRECTED` event. */
  correct(body: ApplicationCorrections): Observable<CorrectApplicationResponse> {
    return this.http.patch<CorrectApplicationResponse>(
      `${API_PREFIX}/portal/application/corrections`,
      body,
    );
  }

  submit(body: ApplicationPatch): Observable<SubmitApplicationResponse> {
    return this.http.post<SubmitApplicationResponse>(
      `${API_PREFIX}/portal/application/submit`,
      body,
    );
  }

  documents(): Observable<PortalDocumentsResponse> {
    return this.http.get<PortalDocumentsResponse>(`${API_PREFIX}/portal/documents`);
  }

  /** Emits progress events (`reportProgress`) and finally the created document. */
  upload(docType: DocType, file: File): Observable<HttpEvent<ApplicantDocument>> {
    const form = new FormData();
    form.append('docType', docType);
    form.append('file', file);
    return this.http.post<ApplicantDocument>(`${API_PREFIX}/portal/documents`, form, {
      reportProgress: true,
      observe: 'events',
    });
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${API_PREFIX}/portal/documents/${encodeURIComponent(id)}`);
  }

  documentFileUrl(id: string): string {
    return `${API_PREFIX}/portal/documents/${encodeURIComponent(id)}/file`;
  }

  /** C35 shape: `[{ id, type, createdAt, data }]`. */
  /** C35: paged, newest first (`limit` ≤ 50, default 20). */
  notifications(page = 1, limit = 20): Observable<Paged<PortalEvent>> {
    return this.http.get<Paged<PortalEvent>>(`${API_PREFIX}/portal/notifications`, {
      params: { page, limit },
    });
  }

  interviewSlots(): Observable<InterviewSlot[]> {
    return this.http.get<InterviewSlot[]>(`${API_PREFIX}/portal/interview-slots`);
  }

  /** A9: 5 an hour per IP (429 `RATE_LIMITED` past that). Returns the booked slot. */
  bookInterview(slotId: string): Observable<InterviewBooking> {
    return this.http.post<InterviewBooking>(`${API_PREFIX}/portal/interview`, { slotId });
  }

  /** C17: `{cancelled: true}`, or 404 when nothing is booked. A9: 5 an hour per IP (429). */
  cancelInterview(): Observable<{ cancelled: true }> {
    return this.http.delete<{ cancelled: true }>(`${API_PREFIX}/portal/interview`);
  }

  /** A4: answered before any lookup or send, so it never means a code went out (`RequestOtpResponse`). */
  requestOtp(identifier: string, channel?: OtpChannel): Observable<RequestOtpResponse> {
    return this.http.post<RequestOtpResponse>(`${API_PREFIX}/portal/auth/request-otp`, {
      identifier,
      ...(channel ? { channel } : {}),
    });
  }

  verifyOtp(identifier: string, code: string): Observable<{ csrfToken: string }> {
    return this.http.post<{ csrfToken: string }>(`${API_PREFIX}/portal/auth/verify-otp`, {
      identifier,
      code,
    });
  }

  logout(): Observable<OkResponse> {
    return this.http.post<OkResponse>(`${API_PREFIX}/portal/auth/logout`, {});
  }
}
