import { HttpInterceptorFn, HttpParams } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError, toApiProblem } from '../api/problem';
import { CsrfTokens } from '../auth/csrf-tokens';
import { SessionExpiry } from '../auth/session-expiry';
import { LocaleService } from '../i18n/locale.service';
import { apiArea, apiPath } from './api-urls';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Content language for public API calls: `?lang=` + `Accept-Language` (plan §2). Admin responses
 * keep both raw fields, so they get no `lang`.
 */
export const localeInterceptor: HttpInterceptorFn = (req, next) => {
  const area = apiArea(req.url);
  if (area === null || area === 'admin') {
    return next(req);
  }
  const lang = inject(LocaleService).lang();
  const hasLang = req.params.has('lang') || /[?&]lang=/.test(req.url);
  const params: HttpParams = hasLang ? req.params : req.params.set('lang', lang);
  return next(req.clone({ params, setHeaders: { 'Accept-Language': lang } }));
};

/** Cookie-authenticated areas send credentials (and are therefore never transfer-cached). */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const area = apiArea(req.url);
  if (area === 'admin' || area === 'portal' || area === 'applications') {
    return next(req.clone({ withCredentials: true }));
  }
  return next(req);
};

/** `X-CSRF-Token` on every non-GET request that carries a session (hard rule 4). */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (SAFE_METHODS.has(req.method)) {
    return next(req);
  }
  const area = apiArea(req.url);
  const tokens = inject(CsrfTokens);
  const token = area === 'admin' ? tokens.staff() : area === 'portal' ? tokens.applicant() : null;
  return token ? next(req.clone({ setHeaders: { 'X-CSRF-Token': token } })) : next(req);
};

/** Paths whose 401 is an answer ("not signed in"), not an expired session. */
const AUTH_PROBES = ['/admin/me', '/admin/auth/', '/portal/me', '/portal/auth/'];

/**
 * Normalises every API failure into `ApiError(ApiProblem)` (RFC 7807, zod issues → field errors).
 * A 401 inside an authenticated area signals session expiry (the stores redirect to login).
 */
export const problemDetailsInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      const problem = toApiProblem(error);
      const area = apiArea(req.url);
      const path = apiPath(req.url) ?? '';
      if (
        problem.status === 401 &&
        (area === 'admin' || area === 'portal') &&
        !AUTH_PROBES.some((p) => path.startsWith(p))
      ) {
        injector.get(SessionExpiry).expired(area);
      }
      return throwError(() => new ApiError(problem));
    }),
  );
};
