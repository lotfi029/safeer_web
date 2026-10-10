import { inject, Injectable } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import type { Lang } from './lang';
import { LocaleService } from './locale.service';

/**
 * The admin dictionary (translations/admin/*.ts) is its own lazy chunk per locale, merged into the
 * active locale under `admin.*` the first time an admin route opens in that locale. The public
 * site's locale chunk therefore never carries dashboard strings.
 */
@Injectable({ providedIn: 'root' })
export class AdminStrings {
  private readonly transloco = inject(TranslocoService);
  private readonly loaded = new Map<Lang, Promise<void>>();

  load(lang: Lang): Promise<void> {
    let pending = this.loaded.get(lang);
    if (!pending) {
      pending = (
        lang === 'en'
          ? import('./translations/admin/en').then((m) => m.en)
          : import('./translations/admin/ar').then((m) => m.ar)
      ).then((dict) => {
        this.transloco.setTranslation({ admin: dict }, lang, { merge: true, emitChange: true });
      });
      pending.catch(() => this.loaded.delete(lang));
      this.loaded.set(lang, pending);
    }
    return pending;
  }
}

/** Runs after langGuard (the `:lang` parent) so the locale's base strings are already in place. */
export const adminStringsGuard: CanActivateFn = async () => {
  await inject(AdminStrings).load(inject(LocaleService).lang());
  return true;
};
