import { Injectable, signal } from '@angular/core';

/**
 * CSRF token returned in response bodies (CONTRACT-NOTES "CSRF"): staff from login / GET /admin/me.
 * Held in memory only.
 */
@Injectable({ providedIn: 'root' })
export class CsrfTokens {
  readonly staff = signal<string | null>(null);
}
