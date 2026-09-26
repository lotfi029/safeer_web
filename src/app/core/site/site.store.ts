import { inject, Injectable, RESPONSE_INIT, signal } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { SiteResponse } from '../api/models';
import { toApiProblem } from '../api/problem';
import { PublicApi } from '../api/public-api';
import { markStatus } from '../data/loaded';

export type SiteFailure = 'unavailable' | 'error';

/**
 * `GET /site` (settings, nav, contact) for the public shell. It is the shell's critical call
 * (review F8): if it fails during SSR the response becomes 503 + Retry-After (API unreachable) or
 * 500, and the shell renders the matching error page instead of hanging or rendering half a page.
 */
@Injectable({ providedIn: 'root' })
export class SiteStore {
  private readonly api = inject(PublicApi);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  readonly site = signal<SiteResponse | null>(null);
  readonly failure = signal<SiteFailure | null>(null);
  private loadedLang: string | null = null;

  async load(lang: string): Promise<void> {
    if (this.loadedLang === lang && this.site()) {
      return;
    }
    try {
      this.site.set(await firstValueFrom(this.api.site()));
      this.failure.set(null);
      this.loadedLang = lang;
    } catch (error) {
      const problem = toApiProblem(error);
      const unavailable =
        problem.status === 0 || problem.status >= 502 || problem.code === 'NETWORK';
      this.failure.set(unavailable ? 'unavailable' : 'error');
      markFailure(this.responseInit, unavailable ? 'unavailable' : 'error');
    }
  }
}

/** Sets the SSR status for a failed critical call (no-op in the browser). */
export function markFailure(responseInit: ResponseInit | null, failure: SiteFailure): void {
  markStatus(responseInit, failure);
}

export const siteResolver: ResolveFn<boolean> = async (route) => {
  const store = inject(SiteStore);
  await store.load(route.paramMap.get('lang') ?? route.parent?.paramMap.get('lang') ?? 'ar');
  return true;
};
