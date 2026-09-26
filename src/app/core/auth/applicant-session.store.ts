import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { PortalMe } from '../api/models';
import { PortalApi } from '../api/portal-api';
import { CsrfTokens } from './csrf-tokens';
import { SessionExpiry } from './session-expiry';
import type { SessionStatus } from './staff-session.store';

/**
 * Applicant session (cookie `sf_app_sid`). The CSRF token comes from `POST /applications`,
 * `verify-otp`, and — after B16 — `GET /portal/me`, so writes keep working after a page reload.
 */
@Injectable({ providedIn: 'root' })
export class ApplicantSessionStore {
  private readonly api = inject(PortalApi);
  private readonly tokens = inject(CsrfTokens);
  private readonly clearListeners: (() => void)[] = [];

  readonly me = signal<PortalMe | null>(null);
  readonly status = signal<SessionStatus>('unknown');
  readonly isAuthenticated = computed(() => this.status() === 'authenticated');
  /** False when the session has no CSRF token (B16 missing): writes would be rejected. */
  readonly canWrite = computed(() => this.isAuthenticated() && !!this.tokens.applicant());

  private inflight: Promise<boolean> | null = null;

  constructor() {
    inject(SessionExpiry).onExpired((area) => area === 'portal' && this.clear());
  }

  ensureLoaded(): Promise<boolean> {
    if (this.status() === 'authenticated') {
      return Promise.resolve(true);
    }
    if (this.status() === 'anonymous') {
      return Promise.resolve(false);
    }
    return (this.inflight ??= this.refresh().finally(() => (this.inflight = null)));
  }

  /** Re-reads `/portal/me` (status, timeline, action needed). Resolves `true` if signed in. */
  async refresh(): Promise<boolean> {
    if (this.status() !== 'authenticated') {
      this.status.set('loading');
    }
    try {
      const me = await firstValueFrom(this.api.me());
      this.me.set(me);
      if (me.csrfToken) {
        this.tokens.applicant.set(me.csrfToken);
      }
      this.status.set('authenticated');
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  /** After `POST /applications` or `verify-otp`: the cookie is set, store the token. */
  startSession(csrfToken: string): void {
    this.tokens.applicant.set(csrfToken);
    this.status.set('authenticated');
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      this.clear();
    }
  }

  /** Called on logout, 401 and explicit clears (e.g. the apply draft listens to this, F5). */
  onClear(listener: () => void): void {
    this.clearListeners.push(listener);
  }

  clear(): void {
    this.me.set(null);
    this.tokens.applicant.set(null);
    this.status.set('anonymous');
    this.clearListeners.forEach((l) => l());
  }
}
