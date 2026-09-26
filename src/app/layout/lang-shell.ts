import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { dirFor, isLang } from '../core/config/lang';

/** Wraps every `/:lang` route and keeps `<html lang dir>` in sync on server and client. */
@Component({
  selector: 'app-lang-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<router-outlet />',
})
export class LangShell {
  readonly lang = input.required<string>();
  private readonly document = inject(DOCUMENT);

  constructor() {
    effect(() => {
      const lang = isLang(this.lang()) ? this.lang() : 'ar';
      const root = this.document.documentElement;
      root.setAttribute('lang', lang);
      root.setAttribute('dir', dirFor(lang as 'ar' | 'en'));
    });
  }
}
