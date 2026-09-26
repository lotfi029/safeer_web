import { describe, expect, it } from 'vitest';
import { finalizeAngularResponse } from './html';

const page =
  '<html><body><app-root ngcspnonce="__CSP_NONCE__"></app-root><script nonce="__CSP_NONCE__"></script></body></html>';

describe('finalizeAngularResponse', () => {
  it('injects the nonce and sets CSP + cache headers on SSR HTML', async () => {
    const res = await finalizeAngularResponse(
      new Response(page, {
        status: 200,
        headers: { 'content-type': 'text/html;charset=UTF-8', 'content-length': '1' },
      }),
      '/ar',
      'NONCE1',
      true,
    );
    const body = await res.text();
    expect(body).not.toContain('__CSP_NONCE__');
    expect(body).toContain('nonce="NONCE1"');
    expect(res.headers.get('content-security-policy')).toContain("'nonce-NONCE1'");
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.has('content-length')).toBe(false);
  });

  it('applies to the CSR shell of admin/portal routes too (R1)', async () => {
    const res = await finalizeAngularResponse(
      new Response(page, { status: 200, headers: { 'content-type': 'text/html' } }),
      '/ar/admin',
      'NONCE2',
      true,
    );
    expect(await res.text()).toContain('nonce="NONCE2"');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('keeps the status code (404) and leaves non-HTML untouched', async () => {
    const notFound = await finalizeAngularResponse(
      new Response(page, { status: 404, headers: { 'content-type': 'text/html' } }),
      '/fr',
      'N',
      true,
    );
    expect(notFound.status).toBe(404);
    const json = new Response('{}', { headers: { 'content-type': 'application/json' } });
    expect(await finalizeAngularResponse(json, '/ar', 'N', true)).toBe(json);
  });

  it('uses report-only CSP in development', async () => {
    const res = await finalizeAngularResponse(
      new Response(page, { headers: { 'content-type': 'text/html' } }),
      '/ar',
      'N',
      false,
    );
    expect(res.headers.has('content-security-policy')).toBe(false);
    expect(res.headers.get('content-security-policy-report-only')).toContain("'nonce-N'");
  });
});
