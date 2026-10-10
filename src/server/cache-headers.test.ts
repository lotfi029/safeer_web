import { describe, expect, it } from 'vitest';
import { htmlCacheHeaders, isPrivateArea, staticCacheControl } from './cache-headers';

describe('HTML cache headers (R2)', () => {
  it('public SSR HTML is no-cache (never shared-cacheable)', () => {
    expect(htmlCacheHeaders('/ar')).toEqual({ 'Cache-Control': 'no-cache' });
    expect(htmlCacheHeaders('/en/news/x')).toEqual({ 'Cache-Control': 'no-cache' });
  });

  it('admin and portal are no-store + noindex', () => {
    for (const path of [
      '/ar/admin',
      '/en/admin/applications',
      '/ar/portal',
      '/en/portal/documents',
    ]) {
      expect(htmlCacheHeaders(path)).toEqual({
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      });
    }
  });

  it('any ?preview= URL is no-store (W18)', () => {
    expect(htmlCacheHeaders('/en/news/x?preview=abc')).toEqual({ 'Cache-Control': 'no-store' });
    expect(htmlCacheHeaders('/ar/news/x?a=1&preview=')).toEqual({ 'Cache-Control': 'no-store' });
    expect(htmlCacheHeaders('/en/news/x?previewed=1')).toEqual({ 'Cache-Control': 'no-cache' });
  });

  it('does not treat look-alike paths as private', () => {
    expect(isPrivateArea('/ar/administration')).toBe(false);
    expect(isPrivateArea('/fr/admin')).toBe(false);
  });
});

describe('static cache headers', () => {
  it('hashed assets are immutable for a year', () => {
    expect(staticCacheControl('/x/main-4HWBHBGG.js')).toContain('immutable');
    expect(staticCacheControl('/x/chunk-B-JlqJFG.js')).toContain('immutable');
    expect(staticCacheControl('/x/styles-7G6WO7MF.css')).toContain('immutable');
  });
  it('unhashed files get a short max-age', () => {
    expect(staticCacheControl('/x/favicon.ico')).toBe('public, max-age=3600');
    expect(staticCacheControl('/x/brand/safeer-logo.png')).toBe('public, max-age=3600');
  });
});
