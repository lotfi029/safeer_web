import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';

/** "No access" state for roleGuard (plan §7: 403 shows a no-access state). */
@Component({
  selector: 'app-forbidden',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="main" class="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 class="t-h2">{{ 'admin.forbidden.title' | transloco }}</h1>
      <p class="t-muted">{{ 'admin.forbidden.body' | transloco }}</p>
    </main>
  `,
})
export class Forbidden {
  constructor() {
    inject(SeoService).noindex('403', inject(LocaleService).lang());
  }
}
