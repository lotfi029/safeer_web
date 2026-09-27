import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../config/api-base-url';
import type { OkResponse, RolesResponse, StaffMe, StaffUser } from './models';

/** Staff auth endpoints used by StaffSessionStore. Session 2 adds the admin feature APIs. */
@Injectable({ providedIn: 'root' })
export class StaffApi {
  private readonly http = inject(HttpClient);

  me(): Observable<StaffMe> {
    return this.http.get<StaffMe>(`${API_PREFIX}/admin/me`);
  }

  login(email: string, password: string): Observable<{ user: StaffUser; csrfToken: string }> {
    return this.http.post<{ user: StaffUser; csrfToken: string }>(
      `${API_PREFIX}/admin/auth/login`,
      { email, password },
    );
  }

  logout(): Observable<OkResponse> {
    return this.http.post<OkResponse>(`${API_PREFIX}/admin/auth/logout`, {});
  }

  /** W16: the invitation link (`/{lang}/admin/accept/{token}`); public, single-use token. */
  acceptInvite(token: string, password: string): Observable<OkResponse> {
    return this.http.post<OkResponse>(
      `${API_PREFIX}/admin/auth/accept/${encodeURIComponent(token)}`,
      { password },
    );
  }

  /** W16: the reset link (`/{lang}/admin/reset/{token}`); public, single-use, 3/h per IP. */
  resetPassword(token: string, password: string): Observable<OkResponse> {
    return this.http.post<OkResponse>(
      `${API_PREFIX}/admin/auth/reset/${encodeURIComponent(token)}`,
      { password },
    );
  }

  roles(): Observable<RolesResponse> {
    return this.http.get<RolesResponse>(`${API_PREFIX}/admin/roles`);
  }
}
