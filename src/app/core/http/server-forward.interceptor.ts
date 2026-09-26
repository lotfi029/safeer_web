import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID, REQUEST_CONTEXT } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { timeout } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url';
import type { SsrRequestContext } from './ssr-context';

/** SSR-side API calls never hang a render (review F8). */
export const SSR_API_TIMEOUT_MS = 5_000;

/**
 * Server only (sessions plan R3): SSR renders call the API from 127.0.0.1, so forward the visitor's
 * IP and language, otherwise every render shares one rate-limit bucket.
 */
export const serverForwardInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformServer(inject(PLATFORM_ID))) {
    return next(req);
  }
  const base = inject(API_BASE_URL);
  if (!req.url.startsWith(base)) {
    return next(req);
  }
  const context = inject(REQUEST_CONTEXT, { optional: true }) as SsrRequestContext | null;
  const headers: Record<string, string> = {};
  if (context?.clientIp) {
    headers['X-Forwarded-For'] = context.clientIp;
  }
  if (context?.acceptLanguage && !req.headers.has('Accept-Language')) {
    headers['Accept-Language'] = context.acceptLanguage;
  }
  return next(req.clone({ setHeaders: headers })).pipe(timeout({ first: SSR_API_TIMEOUT_MS }));
};
