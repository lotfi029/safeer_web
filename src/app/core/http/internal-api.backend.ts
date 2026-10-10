import { FetchBackend, HttpEvent, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, API_PREFIX } from '../config/api-base-url';
import { isApiUrl } from './api-urls';

/** `/api/v1/…` → `${base}/…`; anything else, or a relative base (the browser), is unchanged. */
export function internalApiUrl(url: string, base: string): string {
  return base === API_PREFIX || !isApiUrl(url) ? url : base + url.slice(API_PREFIX.length);
}

/**
 * Server only (W9): SSR calls the API on the internal network, but the rewrite happens here, below
 * every interceptor, including Angular's HTTP transfer cache. The cache on the server and the browser
 * therefore both key on the same relative `/api/v1/…` URL: the browser reuses the SSR responses
 * instead of fetching them again, and the internal origin never reaches the transfer state (the
 * cache stores the request URL in the page).
 */
@Injectable()
export class InternalApiBackend extends FetchBackend {
  private readonly base = inject(API_BASE_URL);

  override handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const url = internalApiUrl(req.url, this.base);
    return super.handle(url === req.url ? req : req.clone({ url }));
  }
}
