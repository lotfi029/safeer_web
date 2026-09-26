import { describe, expect, it } from 'vitest';
import {
  buildCsp,
  createNonce,
  cspHeaderName,
  CSP_NONCE_PLACEHOLDER,
  injectNonce,
} from './security-headers';

describe('CSP (R1)', () => {
  const csp = buildCsp('abc123');

  it('uses nonce + self for scripts, without strict-dynamic', () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    expect(csp).not.toContain('strict-dynamic');
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it('splits styles into nonce-d elements and inline attributes', () => {
    expect(csp).toContain("style-src-elem 'self' 'nonce-abc123'");
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
  });

  it('locks down frames, objects, base and forms', () => {
    for (const d of [
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(d);
    }
  });

  it('is enforced in production and report-only in development', () => {
    expect(cspHeaderName(true)).toBe('Content-Security-Policy');
    expect(cspHeaderName(false)).toBe('Content-Security-Policy-Report-Only');
  });
});

describe('nonce', () => {
  it('is random, base64 and at least 128 bits', () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{24}$/);
    expect(createNonce()).not.toBe(a);
  });

  it('replaces every placeholder occurrence', () => {
    const html = `<app-root ngcspnonce="${CSP_NONCE_PLACEHOLDER}"></app-root><script nonce="${CSP_NONCE_PLACEHOLDER}"></script>`;
    const out = injectNonce(html, 'N0nce');
    expect(out).not.toContain(CSP_NONCE_PLACEHOLDER);
    expect(out.match(/N0nce/g)).toHaveLength(2);
  });
});
