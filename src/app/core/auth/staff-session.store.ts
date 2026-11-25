import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { StaffMe } from '../api/models';
import { ApiError } from '../api/problem';
import { StaffApi } from '../api/staff-api';
import { CsrfTokens } from './csrf-tokens';
import { holds, type PermissionKey } from './permissions';
import { SessionExpiry } from './session-expiry';

export type SessionStatus = 'unknown' | 'loading' | 'authenticated' | 'anonymous';

/**
 * Staff session (cookie `sf_sid`): `me` + CSRF token from `GET /admin/me`, and with it the role and
 * its `permissions` (safeer_api v1.1.0; `["*"]` for admin). Login answers without permissions, so it
 * reads `GET /admin/me` right after. If that read fails nothing is granted: `can()` is false for
 * every key (there is no fallback matrix).
 */
@Injectable({ providedIn: 'root' })
export class StaffSessionStore {
  private readonly api = inject(StaffApi);
  private readonly tokens = inject(CsrfTokens);

  readonly me = signal<StaffMe | null>(null);
  readonly status = signal<SessionStatus>('unknown');
  readonly role = computed(() => this.me()?.role ?? null);
  /** The current role's permission keys (`*` = all); empty when signed out or unknown. */
  readonly permissions = computed<ReadonlySet<string>>(() => new Set(this.me()?.permissions ?? []));
  readonly isAuthenticated = computed(() => this.status() === 'authenticated');

  private inflight: Promise<boolean> | null = null;

  constructor() {
    inject(SessionExpiry).onExpired((area) => area === 'admin' && this.clear());
  }

  /** Loads the session once (subsequent calls reuse the result). Resolves `true` if signed in. */
  ensureLoaded(): Promise<boolean> {
    if (this.status() === 'authenticated') {
      return Promise.resolve(true);
    }
    if (this.status() === 'anonymous') {
      return Promise.resolve(false);
    }
    return (this.inflight ??= this.load().finally(() => (this.inflight = null)));
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(this.api.login(email, password));
    this.tokens.staff.set(res.csrfToken);
    // The login answer has no `permissions`: until `GET /admin/me` says otherwise, nothing is granted.
    this.me.set({ ...res.user, csrfToken: res.csrfToken, permissions: [] });
    this.status.set('authenticated');
    await this.refresh();
  }

  /** Re-reads `GET /admin/me` (role and permissions). On failure keeps the session with no permissions. */
  async refresh(): Promise<void> {
    try {
      const me = await firstValueFrom(this.api.me());
      this.me.set(me);
      this.tokens.staff.set(me.csrfToken);
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 401) {
        this.clear();
        return;
      }
      const current = this.me();
      if (current) this.me.set({ ...current, permissions: [] });
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      this.clear();
    }
  }

  /** Whether the current role holds a permission (`news.view`, `users.manage`, …). */
  can(permission: PermissionKey): boolean {
    return holds(this.permissions(), permission);
  }

  clear(): void {
    this.me.set(null);
    this.tokens.staff.set(null);
    this.status.set('anonymous');
  }

  private async load(): Promise<boolean> {
    this.status.set('loading');
    try {
      const me = await firstValueFrom(this.api.me());
      this.me.set(me);
      this.tokens.staff.set(me.csrfToken);
      this.status.set('authenticated');
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.problem.status !== 401) {
        console.error('admin/me failed', error.problem);
      }
      this.clear();
      return false;
    }
  }
}
