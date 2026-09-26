import { DOCUMENT } from '@angular/common';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpHeaders,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject, REQUEST } from '@angular/core';
import { concat, delay, Observable, of, throwError } from 'rxjs';
import { createMockBackend, type MockBackend } from '../../../../../mocks/backend.mjs';
import { fixtures } from '../../../../../mocks/fixtures.mjs';
import { apiPath } from '../../http/api-urls';

/**
 * Dev-only mock of safeer_api (`environment.useMocks`). Marker checked by
 * scripts/check-prod-artifact.mjs: this must never reach the production bundle.
 */
export const SAFEER_MOCK_REGISTRY = 'SAFEER_MOCK_REGISTRY';

let backend: MockBackend | null = null;
const LATENCY_MS = 120;

function bodyFor(body: unknown): unknown {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const file = body.get('file');
    return {
      docType: body.get('docType'),
      file:
        file instanceof Blob
          ? { name: (file as File).name ?? 'file', size: file.size, type: file.type }
          : undefined,
    };
  }
  return body ?? undefined;
}

export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  const path = apiPath(req.url);
  if (path === null) {
    return next(req);
  }
  backend ??= createMockBackend(fixtures);
  const document = inject(DOCUMENT);
  const request = inject(REQUEST, { optional: true });
  const cookieHeader = request?.headers.get('cookie') ?? document.cookie ?? '';
  const headers: Record<string, string | undefined> = { cookie: cookieHeader };
  for (const key of req.headers.keys()) {
    headers[key.toLowerCase()] = req.headers.get(key) ?? undefined;
  }
  const out = backend.handle({
    method: req.method,
    url: `/api/v1${path === '/' ? '' : path}${req.params.keys().length ? `?${req.params.toString()}` : ''}`,
    headers,
    body: bodyFor(req.body),
  });
  const setCookie = out.headers['set-cookie'];
  if (setCookie && !request) {
    // Dev only: the mock's session cookies live in document.cookie (real ones are HttpOnly).
    document.cookie = setCookie.replace(/;\s*HttpOnly/i, '');
  }
  if (out.status >= 400) {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: out.status,
          error: out.body,
          url: req.urlWithParams,
          headers: new HttpHeaders(out.headers),
        }),
    ).pipe(delay(LATENCY_MS));
  }
  const response = new HttpResponse({
    status: out.status,
    body: out.body,
    url: req.urlWithParams,
    headers: new HttpHeaders(out.headers),
  });
  if (req.reportProgress && req.body instanceof FormData) {
    const total = (bodyFor(req.body) as { file?: { size: number } }).file?.size ?? 1;
    const progress = (loaded: number): Observable<HttpEvent<unknown>> =>
      of({ type: HttpEventType.UploadProgress, loaded, total } as HttpEvent<unknown>).pipe(
        delay(LATENCY_MS * 2),
      );
    return concat(progress(total * 0.3), progress(total * 0.7), progress(total), of(response));
  }
  return of(response).pipe(delay(LATENCY_MS));
};
