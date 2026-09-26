import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { ThemeService } from '../../core/theme/theme.service';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';
import { KitBasicsSection } from './sections/basics-section';
import { KitContentSection } from './sections/content-section';
import { KitFormsSection } from './sections/forms-section';
import { KitOverlaysSection } from './sections/overlays-section';

/**
 * Dev-only component kit (`/:lang/_kit`, excluded from production builds). Every shared UI component
 * in every state, so screens don't need to be reviewed one by one. Switch language and theme from
 * the toolbar; the Playwright matrix screenshots it at every viewport × locale × theme.
 */
@Component({
  selector: 'app-kit-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    Button,
    Icon,
    KitBasicsSection,
    KitContentSection,
    KitFormsSection,
    KitOverlaysSection,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="sr-only focus:not-sr-only" href="#main">{{ 'common.skipToContent' | transloco }}</a>
    <header class="sticky top-0 z-20 border-b border-border bg-bg">
      <div class="wrap flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
        <p class="t-h4">{{ 'kit.title' | transloco }}</p>
        <div class="flex items-center gap-2">
          <a
            appButton
            variant="line"
            size="sm"
            [routerLink]="['/', locale.otherLang(), '_kit']"
            [attr.lang]="locale.otherLang()"
          >
            {{
              (locale.lang() === 'ar' ? 'common.switchToEnglish' : 'common.switchToArabic')
                | transloco
            }}
          </a>
          <button
            type="button"
            class="icon-btn"
            [attr.aria-label]="
              (theme.effective() === 'dark' ? 'common.theme.toLight' : 'common.theme.toDark')
                | transloco
            "
            (click)="theme.toggle()"
          >
            <app-icon [name]="theme.effective() === 'dark' ? 'sun' : 'moon'" />
          </button>
        </div>
      </div>
    </header>
    <main id="main" class="wrap flex flex-col gap-16 py-10">
      <h1 class="t-h1">{{ 'kit.title' | transloco }}</h1>
      <app-kit-basics-section />
      <app-kit-content-section />
      <app-kit-forms-section />
      <app-kit-overlays-section />
    </main>
  `,
})
export class KitPage {
  protected readonly locale = inject(LocaleService);
  protected readonly theme = inject(ThemeService);

  constructor() {
    inject(SeoService).set({
      title: 'Kit',
      path: '/_kit',
      lang: this.locale.lang(),
      noindex: true,
    });
  }
}
