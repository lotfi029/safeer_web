import { expect, test } from '@playwright/test';
import { MOCK_API_URL, mockOnly } from '../support/env';

test.describe(
  'same-origin API proxy + client IP (R3)',
  mockOnly('needs the mock API __echo/__log routes'),
  () => {
    test('browser path: XFF is overwritten with the trusted client IP; cookies, language and bodies pass', async ({
      request,
    }) => {
      const res = await request.post('/api/v1/__echo?x=1', {
        headers: {
          'X-Forwarded-For': '1.2.3.4, 9.9.9.9',
          Forwarded: 'for=6.6.6.6',
          'X-Real-IP': '6.6.6.6',
          'Accept-Language': 'en-US,en;q=0.9',
          Cookie: 'sf_sid=abc; sf_app_sid=def',
          'X-CSRF-Token': 'tok',
        },
        data: { hello: 'world' },
      });
      expect(res.status()).toBe(200);
      const echo = await res.json();
      // TRUST_PROXY=1: the right-most entry is the client; nothing is appended.
      expect(echo.headers['x-forwarded-for']).toBe('9.9.9.9');
      expect(echo.headers['x-forwarded-proto']).toBe('http');
      expect(echo.headers['x-forwarded-host']).toBe('localhost:4100');
      expect(echo.headers['forwarded']).toBeUndefined();
      expect(echo.headers['x-real-ip']).toBeUndefined();
      expect(echo.headers['accept-language']).toBe('en-US,en;q=0.9');
      expect(echo.headers['cookie']).toBe('sf_sid=abc; sf_app_sid=def');
      expect(echo.headers['x-csrf-token']).toBe('tok');
      expect(echo.search).toBe('?x=1');
      expect(echo.bodyBytes).toBeGreaterThan(0);
      expect(res.headers()['set-cookie']).toContain('sf_echo=1');
    });

    test('SSR path: server-side API calls carry the visitor IP and language', async ({
      request,
    }) => {
      await request.delete(`${MOCK_API_URL}/__log`);
      const page = await request.get('/en', {
        headers: { 'X-Forwarded-For': '203.0.113.9', 'Accept-Language': 'en-GB,en;q=0.8' },
      });
      expect(page.status()).toBe(200);
      const log: { path: string; search: string; headers: Record<string, string> }[] = await (
        await request.get(`${MOCK_API_URL}/__log`)
      ).json();
      const siteCall = log.find((e) => e.path === '/api/v1/site');
      expect(siteCall, 'SSR must call GET /api/v1/site').toBeTruthy();
      expect(siteCall!.search).toBe('?lang=en');
      expect(siteCall!.headers['x-forwarded-for']).toBe('203.0.113.9');
      // Public calls carry the page's content language (locale interceptor); the visitor's raw
      // Accept-Language is forwarded only when a call sets none (server-forward interceptor).
      expect(siteCall!.headers['accept-language']).toBe('en');
    });

    test('/files/* is proxied', async ({ request }) => {
      const res = await request.get('/files/abc/card');
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toBe('image/png');
    });
  },
);
