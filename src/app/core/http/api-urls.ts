import { API_PREFIX } from '../config/api-base-url';

/** Path of an API URL relative to `/api/v1` (works for relative and absolute base URLs). */
export function apiPath(url: string): string | null {
  const i = url.indexOf(API_PREFIX);
  if (i < 0) {
    return null;
  }
  const rest = url.slice(i + API_PREFIX.length);
  if (rest !== '' && !rest.startsWith('/') && !rest.startsWith('?')) {
    return null;
  }
  return rest.split('?')[0] || '/';
}

export type ApiArea = 'admin' | 'portal' | 'applications' | 'public';

export function apiArea(url: string): ApiArea | null {
  const path = apiPath(url);
  if (path === null) {
    return null;
  }
  if (path === '/admin' || path.startsWith('/admin/')) {
    return 'admin';
  }
  if (path === '/portal' || path.startsWith('/portal/')) {
    return 'portal';
  }
  if (path === '/applications') {
    return 'applications';
  }
  return 'public';
}

/** A same-origin API URL (`/api/v1`, `/api/v1/…` or `/api/v1?…`), before any server rewrite. */
export function isApiUrl(url: string): boolean {
  return url === API_PREFIX || url.startsWith(`${API_PREFIX}/`) || url.startsWith(`${API_PREFIX}?`);
}
