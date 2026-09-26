import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { StaffSessionStore } from '../../core/auth/staff-session.store';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { Button } from '../../shared/ui/button/button';

/** Guarded placeholder for the admin overview (Session 2 builds the dashboard). */
@Component({
  selector: 'app-admin-placeholder',
  imports: [TranslocoPipe, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="main" class="mx-auto flex min-h-dvh max-w-[1280px] flex-col items-center justify-center gap-4 px-5">
      <h1 class="t-h2">{{ 'admin.home' | transloco }}</h1>
      <p class="t-muted">[...]</p>
      @if (store.me(); as me) {
        <p class="t-small" dir="ltr">{{ me.email }} · {{ me.role }}</p>
        <button appButton variant="line" size="sm" type="button" (click)="logout()">{{ 'admin.logout' | transloco }}</button>
      }
    </main>
  `,
})
export class AdminPlaceholder {
  protected readonly store = inject(StaffSessionStore);
  private readonly router = inject(Router);
  private readonly locale = inject(LocaleService);

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
  }

  protected async logout(): Promise<void> {
    await this.store.logout();
    await this.router.navigateByUrl(this.locale.link('/admin/login'));
  }
}
