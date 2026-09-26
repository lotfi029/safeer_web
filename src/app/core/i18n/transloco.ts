import { EnvironmentProviders, Injectable, isDevMode } from '@angular/core';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { from, Observable } from 'rxjs';
import { LANGS } from './lang';

/**
 * UI strings are bundled TS objects (no HTTP loader): each locale is its own lazy chunk, loaded by
 * the `/:lang` resolver before the route renders, so SSR output is always translated.
 */
@Injectable({ providedIn: 'root' })
export class BundledTranslationLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    return from(
      lang === 'en'
        ? import('./translations/en').then((m) => m.en as unknown as Translation)
        : import('./translations/ar').then((m) => m.ar as unknown as Translation),
    );
  }
}

export function provideAppTransloco(): EnvironmentProviders[] {
  return provideTransloco({
    config: {
      availableLangs: [...LANGS],
      defaultLang: 'ar',
      fallbackLang: 'ar',
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
      missingHandler: { logMissingKey: isDevMode(), useFallbackTranslation: true },
    },
    loader: BundledTranslationLoader,
  }) as unknown as EnvironmentProviders[];
}
