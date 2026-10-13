import { HttpRequest } from '@angular/common/http';
import { isTransferCacheable } from './transfer-cache';

describe('isTransferCacheable', () => {
  it('caches public GETs', () => {
    expect(isTransferCacheable(new HttpRequest('GET', '/api/v1/home?lang=ar'))).toBe(true);
    expect(isTransferCacheable(new HttpRequest('GET', '/api/v1/news/some-slug'))).toBe(true);
  });

  it('never caches non-GET, credentialed or admin requests', () => {
    expect(isTransferCacheable(new HttpRequest('POST', '/api/v1/contact', {}))).toBe(false);
    expect(
      isTransferCacheable(new HttpRequest('GET', '/api/v1/site', { withCredentials: true })),
    ).toBe(false);
    expect(isTransferCacheable(new HttpRequest('GET', '/api/v1/admin/me'))).toBe(false);
    expect(isTransferCacheable(new HttpRequest('GET', '/api/v1/admin?x=1'))).toBe(false);
  });
});
