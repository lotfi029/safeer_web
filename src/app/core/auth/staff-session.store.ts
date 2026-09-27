import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { StaffMe, StaffRole } from '../api/models';
import { ApiError } from '../api/problem';
import { StaffApi } from '../api/staff-api';
import { CsrfTokens } from './csrf-tokens';
import { ROLE_MATRIX, type StaffArea } from './role-matrix';
import { SessionExpiry } from './session-expiry';

export type SessionStatus = 'unknown' | 'loading' | 'authenticated' | 'anonymous';

/**
 * Staff session (cookie `sf_sid`): `me` + CSRF token from `GET /admin/me` or login, and the role
 * matrix from `GET /admin/roles` (B17) with the typed fallback in role-matrix.ts.
 */
@Injectable({ providedIn: 'root' })
export class StaffSessionStore {
  private readonly api = inject(StaffApi);
  private readonly tokens = inject(CsrfTokens);

  readonly me = signal<StaffMe | null>(null);
  readonly status = signal<SessionStatus>('unknown');
  readonly matrix = signal<Readonly<Record<string, readonly StaffRole[]>>>(ROLE_MATRIX);
  readonly role = computed(() => this.me()?.role ?? null);
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
    this.me.set({ ...res.user, csrfToken: res.csrfToken });
    this.status.set('authenticated');
    await this.loadMatrix();
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      this.clear();
    }
  }

  /** Whether the current role may use an area of the matrix (`applications`, `content`, …). */
  can(area: StaffArea): boolean {
    const role = this.role();
    return !!role && (this.matrix()[area] ?? []).includes(role);
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
      await this.loadMatrix();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.problem.status !== 401) {
        console.error('admin/me failed', error.problem);
      }
      this.clear();
      return false;
    }
  }

  private async loadMatrix(): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.roles());
      this.matrix.set(res.matrix);
    } catch {
      this.matrix.set(ROLE_MATRIX);
    }
  }
}
