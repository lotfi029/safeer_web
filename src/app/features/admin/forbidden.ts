import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';

/** "No access" (roleGuard's target), inside the shell so the staff member keeps their menu. */
@Component({
  selector: 'app-forbidden',
  imports: [RouterLink, TranslocoPipe, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card mx-auto flex max-w-xl flex-col items-center gap-4 py-12 text-center">
      <app-icon name="lock" [size]="36" class="text-decor" />
      <h1 class="t-h2 m-0">{{ 'admin.forbidden.title' | transloco }}</h1>
      <p class="t-muted m-0">{{ 'admin.forbidden.body' | transloco }}</p>
      <a appButton variant="line" [routerLink]="locale.link('/admin')">{{
        'admin.shell.items.overview' | transloco
      }}</a>
    </section>
  `,
})
export class Forbidden {
  protected readonly locale = inject(LocaleService);

  constructor() {
    inject(SeoService).noindex('403', this.locale.lang());
  }
}
