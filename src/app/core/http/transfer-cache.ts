import { HttpRequest } from '@angular/common/http';

const PRIVATE_API = /\/(admin|portal)(\/|$|\?)/;

/**
 * The HTTP transfer cache only carries public GETs (sessions plan R8): never credentialed requests
 * and never anything under `/admin` or `/portal`.
 */
export function isTransferCacheable(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && !req.withCredentials && !PRIVATE_API.test(req.url);
}
