import { expect, test } from '@playwright/test';
import { request as httpRequest } from 'node:http';
import { RECORDING_API_URL, SSR_PUBLIC_DOMAIN_URL } from '../support/env';

interface Recorded {
  method: string;
  path: string;
  search: string;
  xff: string | null;
}

/** GET through the SSR server with an explicit Host header (fetch and Playwright can't override it). */
function getWithHost(
  path: string,
  host: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  const target = new URL(path, SSR_PUBLIC_DOMAIN_URL);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        headers: { ...headers, Host: host, 'X-Forwarded-Proto': 'https' },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * B2 (VPS deploy review): Angular's server platform turns every relative request URL into an absolute
 * one on the request's own host, so with PUBLIC_SITE_URL=https://safeer-sa.org SSR fetched
 * https://safeer-sa.org/api/v1/site instead of API_INTERNAL_URL: a 503 on staging (DNS still on the old
 * site) and a hairpin through the internet after cutover. e2e used localhost, which hid it. This server
 * runs with PUBLIC_SITE_URL=https://safeer.test (no DNS): a page can only render if every SSR call went
 * to API_INTERNAL_URL, the recorder in front of the API.
 */
test.describe('SSR calls the API internally, never through its public domain (B2)', () => {
  for (const host of ['safeer.test', 'www.safeer.test']) {
    test(`/ar with Host: ${host} renders from the internal API`, async () => {
      // A TEST-NET-3 address no other spec uses finds this render's calls in the shared recording.
      const ip = `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
      const page = await getWithHost('/ar', host, { 'X-Forwarded-For': ip });
      expect(page.status, page.body.slice(0, 300)).toBe(200);
      expect(page.body).toContain('ng-state');

      const recorded = (await (
        await fetch(`${RECORDING_API_URL}/__recorded`)
      ).json()) as Recorded[];
      const mine = recorded.filter((r) => r.xff === ip);
      const paths = mine.map((r) => r.path);
      expect(paths, 'SSR must call GET /api/v1/site on API_INTERNAL_URL').toContain('/api/v1/site');
      expect(paths, 'and the home aggregate').toContain('/api/v1/home');
      // The visitor's IP is forwarded on every SSR call (one rate-limit bucket per visitor, R3).
      expect(mine.every((r) => r.xff === ip)).toBe(true);
    });
  }
});
