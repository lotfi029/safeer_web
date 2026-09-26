import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, REQUEST_CONTEXT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-base-url';
import { apiBaseUrlInterceptor, isApiUrl } from './api-base-url.interceptor';
import { serverForwardInterceptor } from './server-forward.interceptor';

function setup(platform: 'browser' | 'server', base: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiBaseUrlInterceptor, serverForwardInterceptor])),
      provideHttpClientTesting(),
      { provide: PLATFORM_ID, useValue: platform },
      { provide: API_BASE_URL, useValue: base },
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

  it('keeps relative URLs and adds no forwarding headers in the browser', () => {
    const { http, ctrl } = setup('browser', '/api/v1');
    http.get('/api/v1/site').subscribe();
    const req = ctrl.expectOne('/api/v1/site');
    expect(req.request.headers.has('X-Forwarded-For')).toBe(false);
    req.flush({});
    ctrl.verify();
  });

  it('rewrites to the internal API and forwards client IP + language during SSR (R3)', () => {
    const { http, ctrl } = setup('server', 'http://127.0.0.1:3000/api/v1');
    http.get('/api/v1/site?lang=ar').subscribe();
    const req = ctrl.expectOne('http://127.0.0.1:3000/api/v1/site?lang=ar');
    expect(req.request.headers.get('X-Forwarded-For')).toBe('203.0.113.7');
    expect(req.request.headers.get('Accept-Language')).toBe('en-US,en;q=0.9');
    req.flush({});
    ctrl.verify();
  });

  it('does not forward headers to non-API URLs during SSR', () => {
    const { http, ctrl } = setup('server', 'http://127.0.0.1:3000/api/v1');
    http.get('https://example.org/x').subscribe();
    const req = ctrl.expectOne('https://example.org/x');
    expect(req.request.headers.has('X-Forwarded-For')).toBe(false);
    req.flush({});
  });
});
