import { HttpClient, HttpEvent } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../config/api-base-url';
import type {
  ApplicantDocument,
  ApplicationPatch,
  ApplicationStep1,
  CreateApplicationResponse,
  DocType,
  InterviewSlot,
  OkResponse,
  OtpChannel,
  PatchApplicationResponse,
  PortalDocumentsResponse,
  PortalEvent,
  PortalMe,
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

  patch(body: ApplicationPatch): Observable<PatchApplicationResponse> {
    return this.http.patch<PatchApplicationResponse>(`${API_PREFIX}/portal/application`, body);
  }

  submit(body: ApplicationPatch): Observable<SubmitApplicationResponse> {
    return this.http.post<SubmitApplicationResponse>(`${API_PREFIX}/portal/application/submit`, body);
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
  notifications(): Observable<PortalEvent[]> {
    return this.http.get<PortalEvent[]>(`${API_PREFIX}/portal/notifications`);
  }

  interviewSlots(): Observable<InterviewSlot[]> {
    return this.http.get<InterviewSlot[]>(`${API_PREFIX}/portal/interview-slots`);
  }

  bookInterview(slotId: string): Observable<OkResponse> {
    return this.http.post<OkResponse>(`${API_PREFIX}/portal/interview`, { slotId });
  }

  /** C17 (mocked until live). */
  cancelInterview(): Observable<void> {
    return this.http.delete<void>(`${API_PREFIX}/portal/interview`);
  }

  requestOtp(identifier: string, channel?: OtpChannel): Observable<OkResponse> {
    return this.http.post<OkResponse>(`${API_PREFIX}/portal/auth/request-otp`, {
      identifier,
      ...(channel ? { channel } : {}),
    });
  }

  verifyOtp(identifier: string, code: string): Observable<{ csrfToken: string }> {
    return this.http.post<{ csrfToken: string }>(`${API_PREFIX}/portal/auth/verify-otp`, { identifier, code });
  }

  logout(): Observable<OkResponse> {
    return this.http.post<OkResponse>(`${API_PREFIX}/portal/auth/logout`, {});
  }
}
