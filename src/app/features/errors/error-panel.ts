import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { Button } from '../../shared/ui/button/button';
import { FlowingLines } from '../../shared/ui/flowing-lines/flowing-lines';

export type ErrorKind = 'notFound' | 'serverError' | 'unavailable';

/** Shared layout for the 404 / 500 / 503 pages (no prototype screen: derived from the spec). */
@Component({
  selector: 'app-error-panel',
  imports: [RouterLink, TranslocoPipe, Button, FlowingLines],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="relative overflow-hidden bg-hero">
      <app-flowing-lines />
      <div
        class="wrap relative z-1 flex min-h-[60dvh] flex-col items-start justify-center gap-5 py-16"
      >
        <p class="t-eyebrow">{{ 'errorPages.' + kind() + '.eyebrow' | transloco }}</p>
        <h1 class="t-h1">{{ 'errorPages.' + kind() + '.title' | transloco }}</h1>
        <p class="t-lead max-w-160">{{ 'errorPages.' + kind() + '.body' | transloco }}</p>
        <div class="flex flex-wrap gap-3">
          @if (kind() === 'notFound') {
            <a appButton [routerLink]="locale.link('/')">{{ 'errorPages.goHome' | transloco }}</a>
            <a appButton variant="ghost" [routerLink]="locale.link('/contact')">{{
              'errorPages.contact' | transloco
            }}</a>
          } @else {
            <a appButton [href]="retryHref()">{{ 'errorPages.retry' | transloco }}</a>
          }
        </div>
      </div>
    </section>
  `,
})
export class ErrorPanel {
  readonly kind = input<ErrorKind>('notFound');
  /** Full reload of the current URL (a new SSR attempt). */
  readonly retryHref = input('');
  protected readonly locale = inject(LocaleService);
}
