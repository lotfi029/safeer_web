import { filesImageLoader, srcsetWidths, variantFor } from './files-image-loader';

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
});
