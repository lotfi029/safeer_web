import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { StaffApi } from '../../../core/api/staff-api';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { Button } from '../../../shared/ui/button/button';
import { Control, Field } from '../../../shared/ui/field/field';
import { AdminAuthFrame } from './auth-frame';

/**
 * `POST /admin/auth/forgot`: the API answers `{ ok: true }` at once for any address, so the page
 * shows the same neutral confirmation whatever was typed. The mailed link opens `reset/:token` (W16).
 */
@Component({
  selector: 'app-admin-forgot',
  imports: [FormField, RouterLink, TranslocoPipe, Field, Control, Button, AdminAuthFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-auth-frame
      [heading]="'admin.forgot.title' | transloco"
      [lead]="done() ? null : ('admin.forgot.lead' | transloco)"
    >
      @if (done()) {
        <div class="card flex flex-col gap-5">
          <p class="note note-ok m-0" role="status">{{ 'admin.forgot.done' | transloco }}</p>
          <a appButton variant="line" [routerLink]="locale.link('/admin/login')">{{
            'admin.forgot.back' | transloco
          }}</a>
        </div>
      } @else {
        <form class="card flex flex-col gap-5" novalidate (submit)="onSubmit($event)">
          <app-field
            [label]="'admin.forgot.email' | transloco"
            [state]="model.email()"
            [forceErrors]="tried()"
          >
            <input
              appControl
              type="email"
              autocomplete="username"
              dir="ltr"
              [formField]="model.email"
            />
          </app-field>
          @if (errorKey(); as key) {
            <p class="note note-warn" role="alert">{{ key | transloco }}</p>
          }
          <button appButton type="submit" [busy]="busy()" [disabled]="busy()">
            {{ 'admin.forgot.submit' | transloco }}
          </button>
          <a class="self-start font-semibold" [routerLink]="locale.link('/admin/login')">{{
            'admin.forgot.back' | transloco
          }}</a>
        </form>
      }
    </app-admin-auth-frame>
  `,
})
export class AdminForgot {
  private readonly api = inject(StaffApi);
  protected readonly locale = inject(LocaleService);

  protected readonly value = signal({ email: '' });
  protected readonly model = form(this.value, (p) => {
    required(p.email);
    email(p.email);
  });
  protected readonly busy = signal(false);
  protected readonly tried = signal(false);
  protected readonly done = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    this.errorKey.set(null);
    await submit(this.model, async () => {
      this.busy.set(true);
      try {
        await firstValueFrom(this.api.forgot(this.value().email));
        this.done.set(true);
      } catch (error) {
        this.errorKey.set(problemMessageKey(toApiProblem(error)));
      } finally {
        this.busy.set(false);
      }
      return undefined;
    });
  }
}
