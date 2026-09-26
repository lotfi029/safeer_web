import { describe, expect, it } from 'vitest';
import { collapseBilingual, resolveLang } from './collapse.mjs';

describe('mock locale collapse (mirrors the API LocaleInterceptor)', () => {
  it('picks ?lang over Accept-Language and defaults to ar', () => {
    expect(resolveLang('en', 'ar')).toBe('en');
    expect(resolveLang(null, 'en-US,en;q=0.9')).toBe('en');
    expect(resolveLang(null, undefined)).toBe('ar');
  });

  it('collapses xAr/xEn pairs with Arabic fallback, recursively', () => {
    const raw = {
      _source: 'x',
      titleAr: 'عربي',
      titleEn: '',
      items: [{ nameAr: 'أ', nameEn: 'A' }],
      phone: '1',
    };
    expect(collapseBilingual(raw, 'en')).toEqual({
      title: 'عربي',
      items: [{ name: 'A' }],
      phone: '1',
    });
    expect(collapseBilingual(raw, 'ar')).toEqual({
      title: 'عربي',
      items: [{ name: 'أ' }],
      phone: '1',
    });
  });
});
