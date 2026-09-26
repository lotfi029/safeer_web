export declare function resolveLang(
  query: string | null,
  acceptLanguage: string | undefined,
): 'ar' | 'en';
export declare function collapseBilingual<T>(value: T, lang: 'ar' | 'en'): unknown;
