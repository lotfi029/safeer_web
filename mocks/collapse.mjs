/**
 * Mirrors the API's LocaleInterceptor (docs/api/CONTRACT-NOTES.md "Locale"): every `xAr`/`xEn` pair
 * collapses into `x`, falling back to Arabic when English is empty. Keys starting with `_` are
 * fixture metadata and are dropped. Shared by the Node mock API and (Phase 1) the in-app mocks.
 */
export function resolveLang(query, acceptLanguage) {
  if (query === 'ar' || query === 'en') return query;
  const first = (acceptLanguage ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'ar';
}

export function collapseBilingual(value, lang) {
  if (Array.isArray(value)) return value.map((v) => collapseBilingual(v, lang));
  if (value === null || typeof value !== 'object') return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (key.startsWith('_')) continue;
    const m = /^(.*)(Ar|En)$/.exec(key);
    if (m && `${m[1]}Ar` in value && `${m[1]}En` in value) {
      if (m[2] === 'En') continue;
      const en = value[`${m[1]}En`];
      out[m[1]] = lang === 'en' && en !== null && en !== '' ? en : v;
      continue;
    }
    out[key] = collapseBilingual(v, lang);
  }
  return out;
}
