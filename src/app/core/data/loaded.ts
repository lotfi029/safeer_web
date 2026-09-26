import { inject, RESPONSE_INIT } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { toApiProblem } from '../api/problem';

export type LoadFailure = 'notFound' | 'unavailable' | 'error';

/** Result of a page's critical API call, produced by a route resolver. */
export type Loaded<T> = { data: T; failure: null } | { data: null; failure: LoadFailure };

/**
 * Loads a page's critical data (review F8). On failure it sets the SSR status — 404 for
 * NOT_FOUND, 503 + Retry-After: 30 when the API is unreachable, else 500 — and returns the failure
 * so the page renders the matching error panel (`<app-page-state>`). Must be called in an injection
 * context (a resolver) before the first await.
 */
export function loadCritical<T>(source: Observable<T>): Promise<Loaded<T>> {
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  return firstValueFrom(source).then(
    (data): Loaded<T> => ({ data, failure: null }),
    (error): Loaded<T> => {
      const problem = toApiProblem(error);
      const failure: LoadFailure =
        problem.status === 404
          ? 'notFound'
          : problem.status === 0 || problem.status >= 502 || problem.code === 'NETWORK'
            ? 'unavailable'
            : 'error';
      markStatus(responseInit, failure);
      return { data: null, failure };
    },
  );
}

/**
 * Secondary sections (related news, testimonials strip, …) degrade to an empty/fallback value, never
 * to an error page (review F8).
 */
export function loadSecondary<T>(source: Observable<T>, fallback: T): Promise<T> {
  return firstValueFrom(source).catch(() => fallback);
}

export function markStatus(responseInit: ResponseInit | null, failure: LoadFailure): void {
  if (!responseInit) {
    return;
  }
  responseInit.status = failure === 'notFound' ? 404 : failure === 'unavailable' ? 503 : 500;
  if (failure === 'unavailable') {
    const headers = new Headers(responseInit.headers);
    headers.set('Retry-After', '30');
    responseInit.headers = headers;
  }
}
