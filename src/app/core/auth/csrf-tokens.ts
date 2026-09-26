import { Injectable, signal } from '@angular/core';

/**
 * CSRF tokens returned in response bodies (CONTRACT-NOTES "CSRF"): staff from login / GET /admin/me,
 * applicant from POST /applications, verify-otp and GET /portal/me (B16). Held in memory only.
 */
@Injectable({ providedIn: 'root' })
export class CsrfTokens {
  readonly staff = signal<string | null>(null);
  readonly applicant = signal<string | null>(null);
}
