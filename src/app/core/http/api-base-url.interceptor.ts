import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL, API_PREFIX } from '../config/api-base-url';

/** Rewrites `/api/v1/...` to the platform's API base (identity in the browser). */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  if (base === API_PREFIX || !isApiUrl(req.url)) {
    return next(req);
  }
  return next(req.clone({ url: base + req.url.slice(API_PREFIX.length) }));
};

export function isApiUrl(url: string): boolean {
  return url === API_PREFIX || url.startsWith(`${API_PREFIX}/`) || url.startsWith(`${API_PREFIX}?`);
}
