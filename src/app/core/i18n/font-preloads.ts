import type { Lang } from './lang';

/**
 * W13: the faces the first screen actually uses, per language: body text (400) and the display
 * heading (700). Everything else loads on demand through /fonts/fonts.css (font-display: swap).
 */
export const ABOVE_THE_FOLD_FONTS: Readonly<Record<Lang, readonly string[]>> = {
  ar: [
    '/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2',
    '/fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2',
  ],
  en: [
    '/fonts/ibm-plex-sans-latin-400-normal.woff2',
    '/fonts/ibm-plex-sans-latin-700-normal.woff2',
  ],
};

const MARK = 'data-font-preload';

/** Replaces the font preloads in `<head>` with the ones for `lang` (rendered into the SSR HTML). */
export function applyFontPreloads(document: Document, lang: Lang): void {
  document.head.querySelectorAll(`link[${MARK}]`).forEach((el) => el.remove());
  for (const href of ABOVE_THE_FOLD_FONTS[lang]) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'preload');
    link.setAttribute('as', 'font');
    link.setAttribute('type', 'font/woff2');
    link.setAttribute('crossorigin', '');
    link.setAttribute('href', href);
    link.setAttribute(MARK, '');
    document.head.appendChild(link);
  }
}
