import { filesImageLoader, srcsetWidths, variantFor, withFileQuery } from './files-image-loader';

describe('files image loader (F12)', () => {
  it('picks the smallest covering variant', () => {
    expect(variantFor(300)).toBe('thumb');
    expect(variantFor(400)).toBe('thumb');
    expect(variantFor(600)).toBe('card');
    expect(variantFor(1200)).toBe('full');
    expect(variantFor(3000)).toBe('full');
  });

  it('builds deduped width descriptors capped at the original width', () => {
    expect(srcsetWidths(2400)).toEqual([400, 800, 1600]);
    expect(srcsetWidths(600)).toEqual([400, 600]);
    expect(srcsetWidths(300)).toEqual([300]);
    expect(srcsetWidths(null)).toEqual([400, 800, 1600]);
  });

  it('maps files/ sources to variant URLs and leaves others alone', () => {
    expect(filesImageLoader({ src: 'files/abc', width: 600 })).toBe('/files/abc/card');
    expect(filesImageLoader({ src: 'files/a b' })).toBe('/files/a%20b/card');
    expect(filesImageLoader({ src: '/brand/safeer-logo.png', width: 400 })).toBe(
      '/brand/safeer-logo.png',
    );
  });

  it('appends a preview file query (C41)', () => {
    expect(
      filesImageLoader({
        src: 'files/abc',
        width: 600,
        loaderParams: { fileQuery: 'preview=t&post=9' },
      }),
    ).toBe('/files/abc/card?preview=t&post=9');
  });
});

describe('withFileQuery (C41)', () => {
  it('appends the query to /files URLs in src, href and srcset only', () => {
    const html =
      '<img src="/files/a/card" srcset="/files/a/thumb 400w, /files/a/card 800w">' +
      '<a href="/files/doc">d</a><img src="https://x.test/files/b"><p>/files/c</p>';
    expect(withFileQuery(html, 'preview=t&post=9')).toBe(
      '<img src="/files/a/card?preview=t&post=9" srcset="/files/a/thumb?preview=t&post=9 400w, /files/a/card?preview=t&post=9 800w">' +
        '<a href="/files/doc?preview=t&post=9">d</a><img src="https://x.test/files/b"><p>/files/c</p>',
    );
  });

  it('is a no-op without a query', () => {
    expect(withFileQuery('<img src="/files/a">', undefined)).toBe('<img src="/files/a">');
    expect(withFileQuery(null, 'q')).toBeNull();
  });
});
