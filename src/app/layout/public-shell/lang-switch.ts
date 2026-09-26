import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { LocaleService } from '../../core/i18n/locale.service';

/** Swaps the leading `/ar` ↔ `/en` of a URL, keeping path, query and fragment. */
export function switchLangUrl(url: string, to: 'ar' | 'en'): string {
  const match = /^\/(ar|en)(?=\/|\?|#|$)/.exec(url);
  return match ? `/${to}${url.slice(match[0].length)}` : `/${to}`;
}

/**
 * Language switch: a real link to the same page in the other language (hreflang + lang on the
 * link). Hidden when English is disabled in site settings (`enEnabled`).
 */
@Component({
  selector: 'app-lang-switch',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-btn border border-border px-3 text-sm font-semibold text-text-muted no-underline hover:bg-raise hover:text-text"
      [href]="href()"
      [attr.hreflang]="locale.otherLang()"
      [attr.lang]="locale.otherLang()"
      [attr.aria-label]="
        (locale.otherLang() === 'en' ? 'common.switchToEnglish' : 'common.switchToArabic')
          | transloco
      "
    >
      <span>{{ locale.otherLang() === 'en' ? 'EN' : 'ع' }}</span>
    </a>
  `,
})
export class LangSwitch {
  protected readonly locale = inject(LocaleService);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly href = computed(() => switchLangUrl(this.url(), this.locale.otherLang()));
}
