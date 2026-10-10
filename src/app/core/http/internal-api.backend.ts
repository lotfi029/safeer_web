import { FetchBackend, HttpEvent, HttpRequest } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, API_PREFIX } from '../config/api-base-url';
import { isApiUrl } from './api-urls';

/**
 * Server only (B2): the hostnames this site answers to (PUBLIC_SITE_URL's host + `www`, plus
 * localhost outside production), provided in `app.config.server.ts`. An absolute API URL on one of
 * them is this site's own API, so SSR sends it to the internal origin too.
 */
export const SSR_PUBLIC_HOSTS = new InjectionToken<readonly string[]>('SSR_PUBLIC_HOSTS', {
  providedIn: 'root',
  factory: () => [],
});

/** The `/api/v1…` path + query of an absolute http(s) URL on one of `publicHosts`, else null. */
function ownApiPath(url: string, publicHosts: readonly string[]): string | null {
  if (!/^https?:\/\//i.test(url)) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!publicHosts.includes(parsed.hostname.toLowerCase())) {
    return null;
  }
  const relative = parsed.pathname + parsed.search;
  return isApiUrl(relative) ? relative : null;
}

/**
 * `/api/v1/…` → `${base}/…`; anything else, or a relative base (the browser), is unchanged.
 *
 * B2: during SSR, Angular's server platform makes every relative request URL absolute on the
 * request's own host (`relativeUrlsTransformerInterceptorFn`, a root interceptor that runs after the
 * app's own interceptors and the transfer cache), so the backend receives
 * `https://safeer-sa.org/api/v1/site`, not `/api/v1/site`. That absolute form is rewritten too
 * when its host is one of `publicHosts`; a foreign host is left alone.
 */
export function internalApiUrl(
  url: string,
  base: string,
  publicHosts: readonly string[] = [],
): string {
  if (base === API_PREFIX) {
    return url;
  }
  const path = isApiUrl(url) ? url : ownApiPath(url, publicHosts);
  return path === null ? url : base + path.slice(API_PREFIX.length);
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
  private readonly publicHosts = inject(SSR_PUBLIC_HOSTS);

  override handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const url = internalApiUrl(req.url, this.base, this.publicHosts);
    return super.handle(url === req.url ? req : req.clone({ url }));
  }
}
