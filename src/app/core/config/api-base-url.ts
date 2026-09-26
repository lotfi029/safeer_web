import { InjectionToken } from '@angular/core';

/** Relative API prefix used by all services. */
export const API_PREFIX = '/api/v1';

/**
 * Where API calls go: the relative `/api/v1` in the browser (same-origin proxy), and
 * `${API_INTERNAL_URL}/api/v1` during SSR (provided in `app.config.server.ts`).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => API_PREFIX,
});
