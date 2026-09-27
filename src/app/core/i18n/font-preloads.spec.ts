import { ABOVE_THE_FOLD_FONTS, applyFontPreloads } from './font-preloads';

describe('font preloads (W13)', () => {
  afterEach(() =>
    document.head.querySelectorAll('link[data-font-preload]').forEach((l) => l.remove()),
  );

  const preloads = () =>
    [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map(
      (l) => l.getAttribute('href'),
    );

  it('preloads only the two above-the-fold faces for the language', () => {
    applyFontPreloads(document, 'ar');
    expect(preloads()).toEqual([...ABOVE_THE_FOLD_FONTS.ar]);
    const link = document.head.querySelector('link[data-font-preload]')!;
    expect(link.getAttribute('crossorigin')).toBe('');
    expect(link.getAttribute('type')).toBe('font/woff2');
  });

  it('replaces them when the language changes', () => {
    applyFontPreloads(document, 'ar');
    applyFontPreloads(document, 'en');
    expect(preloads()).toEqual([...ABOVE_THE_FOLD_FONTS.en]);
  });
});
