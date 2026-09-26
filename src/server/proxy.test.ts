import { describe, expect, it } from 'vitest';
import { rewriteForwardingHeaders, upstreamProblem } from './proxy';

function fakeProxyReq(initial: Record<string, string>) {
  const headers = new Map(Object.entries(initial));
  return {
    headers,
    setHeader: (k: string, v: string) => headers.set(k.toLowerCase(), v),
    removeHeader: (k: string) => headers.delete(k.toLowerCase()),
  };
}

describe('rewriteForwardingHeaders (R3)', () => {
  it('overwrites X-Forwarded-For with the trusted client IP instead of appending', () => {
    const req = fakeProxyReq({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' });
    rewriteForwardingHeaders(req as never, {
      ip: '9.9.9.9',
      protocol: 'https',
      host: 'safeer-sa.org',
    });
    expect(req.headers.get('x-forwarded-for')).toBe('9.9.9.9');
    expect(req.headers.get('x-forwarded-proto')).toBe('https');
    expect(req.headers.get('x-forwarded-host')).toBe('safeer-sa.org');
  });

  it('strips spoofable address headers', () => {
    const req = fakeProxyReq({
      forwarded: 'for=6.6.6.6',
      'x-real-ip': '6.6.6.6',
      'x-forwarded-port': '1',
    });
    rewriteForwardingHeaders(req as never, { ip: '8.8.8.8', protocol: 'http' });
    expect(req.headers.has('forwarded')).toBe(false);
    expect(req.headers.has('x-real-ip')).toBe(false);
    expect(req.headers.has('x-forwarded-port')).toBe(false);
  });
});

describe('upstreamProblem (R7)', () => {
  it('maps connection errors to 502 problem+json', () => {
    expect(upstreamProblem('ECONNREFUSED')).toMatchObject({
      status: 502,
      code: 'UPSTREAM_UNAVAILABLE',
    });
  });
  it('maps timeouts to 504', () => {
    expect(upstreamProblem('ETIMEDOUT')).toMatchObject({ status: 504, code: 'UPSTREAM_TIMEOUT' });
  });
});
