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

  /** B17 (mocked until live). */
  roles(): Observable<RolesResponse> {
    return this.http.get<RolesResponse>(`${API_PREFIX}/admin/roles`);
  }
}
