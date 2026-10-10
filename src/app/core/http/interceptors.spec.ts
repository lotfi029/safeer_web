import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, REQUEST_CONTEXT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { isApiUrl } from './api-urls';
import { internalApiUrl } from './internal-api.backend';
import { serverForwardInterceptor } from './server-forward.interceptor';

function setup(platform: 'browser' | 'server') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([serverForwardInterceptor])),
      provideHttpClientTesting(),
      { provide: PLATFORM_ID, useValue: platform },
      {
        provide: REQUEST_CONTEXT,
        useValue: { clientIp: '203.0.113.7', acceptLanguage: 'en-US,en;q=0.9' },
      },
    ],
  });
  return { http: TestBed.inject(HttpClient), ctrl: TestBed.inject(HttpTestingController) };
}

describe('API interceptors', () => {
  it('recognises API URLs', () => {
    expect(isApiUrl('/api/v1/site')).toBe(true);
    expect(isApiUrl('/api/v1?x')).toBe(true);
    expect(isApiUrl('/api/v10/site')).toBe(false);
    expect(isApiUrl('/files/abc')).toBe(false);
  });

  it('adds no forwarding headers in the browser', () => {
    const { http, ctrl } = setup('browser');
    http.get('/api/v1/site').subscribe();
    const req = ctrl.expectOne('/api/v1/site');
    expect(req.request.headers.has('X-Forwarded-For')).toBe(false);
    req.flush({});
    ctrl.verify();
  });

  it('forwards client IP + language during SSR and keeps the relative URL for the transfer cache (R3, W9)', () => {
    const { http, ctrl } = setup('server');
    http.get('/api/v1/site?lang=ar').subscribe();
    const req = ctrl.expectOne('/api/v1/site?lang=ar');
    expect(req.request.headers.get('X-Forwarded-For')).toBe('203.0.113.7');
    expect(req.request.headers.get('Accept-Language')).toBe('en-US,en;q=0.9');
    req.flush({});
    ctrl.verify();
  });

  it('does not forward headers to non-API URLs during SSR', () => {
    const { http, ctrl } = setup('server');
    http.get('https://example.org/x').subscribe();
    const req = ctrl.expectOne('https://example.org/x');
    expect(req.request.headers.has('X-Forwarded-For')).toBe(false);
    req.flush({});
  });
});

describe('internalApiUrl (W9: the rewrite below the transfer cache)', () => {
  const base = 'http://127.0.0.1:3000/api/v1';

  it('sends API URLs to the internal base on the server', () => {
    expect(internalApiUrl('/api/v1/site?lang=ar', base)).toBe(
      'http://127.0.0.1:3000/api/v1/site?lang=ar',
    );
    expect(internalApiUrl('/api/v1?x=1', base)).toBe('http://127.0.0.1:3000/api/v1?x=1');
  });

  it('leaves other URLs, and everything in the browser, unchanged', () => {
    expect(internalApiUrl('/files/abc', base)).toBe('/files/abc');
    expect(internalApiUrl('/api/v10/x', base)).toBe('/api/v10/x');
    expect(internalApiUrl('/api/v1/site', '/api/v1')).toBe('/api/v1/site');
  });
});
