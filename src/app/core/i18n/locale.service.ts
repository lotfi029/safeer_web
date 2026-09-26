import { Directionality } from '@angular/cdk/bidi';
import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Cookies } from '../platform/cookies';
import { DEFAULT_LANG, dirFor, Lang, LANG_COOKIE } from './lang';

/**
 * Current UI language. Drives `<html lang dir>` (server and client), the CDK Directionality used by
 * overlays/drag-drop, Transloco, and the `lang` preference cookie read by server.ts for `/`.
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly directionality = inject(Directionality);
  private readonly cookies = inject(Cookies);

  private readonly current = signal<Lang>(DEFAULT_LANG);
  readonly lang = this.current.asReadonly();
  readonly dir = computed(() => dirFor(this.current()));
  readonly otherLang = computed<Lang>(() => (this.current() === 'ar' ? 'en' : 'ar'));
  /** BCP 47 tag for Intl APIs. Arabic uses Arabic-Indic digits (spec §2). */
  readonly intlLocale = computed(() => (this.current() === 'ar' ? 'ar-SA-u-nu-arab' : 'en-GB'));

  async use(lang: Lang): Promise<void> {
    await firstValueFrom(this.transloco.load(lang));
    this.transloco.setActiveLang(lang);
    this.current.set(lang);
    const root = this.document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', dirFor(lang));
    this.directionality.valueSignal.set(dirFor(lang));
    if (this.cookies.get(LANG_COOKIE) !== lang) {
      this.cookies.set(LANG_COOKIE, lang);
    }
  }

  /** Prefixes a locale-agnostic app path (`/apply`) with the current language (`/ar/apply`). */
  link(path: string, lang: Lang = this.current()): string {
    const clean = path.startsWith('/') ? path : `/${path}`;
    return clean === '/' ? `/${lang}` : `/${lang}${clean}`;
  }
}
