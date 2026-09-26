import { dirFor, isLang } from './lang';

describe('lang', () => {
  it('accepts only ar and en', () => {
    expect(isLang('ar')).toBe(true);
    expect(isLang('en')).toBe(true);
    expect(isLang('fr')).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
  it('maps direction', () => {
    expect(dirFor('ar')).toBe('rtl');
    expect(dirFor('en')).toBe('ltr');
  });
});
