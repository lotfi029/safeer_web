import { htmlCacheHeaders } from './cache-headers';
import { buildCsp, cspHeaderName, injectNonce } from './security-headers';

/**
 * Post-processes a response from the Angular engine. For HTML (SSR output and the CSR shell served to
 * RenderMode.Client routes alike) it swaps the nonce placeholder, and adds CSP + cache headers.
 */
export async function finalizeAngularResponse(
  response: Response,
  /** Request path with its query string (`req.originalUrl`). */
  url: string,
  nonce: string,
  isProduction: boolean,
): Promise<Response> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    return response;
  }
  const html = injectNonce(await response.text(), nonce);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set(cspHeaderName(isProduction), buildCsp(nonce));
  for (const [name, value] of Object.entries(htmlCacheHeaders(url))) {
    headers.set(name, value);
  }
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
