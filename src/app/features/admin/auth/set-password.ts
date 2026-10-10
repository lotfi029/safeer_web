import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { form, FormField, minLength, required, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { StaffApi } from '../../../core/api/staff-api';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { problemToTreeErrors } from '../../../shared/forms/server-errors';
import { Button } from '../../../shared/ui/button/button';
import { Control, Field } from '../../../shared/ui/field/field';
import { AdminAuthFrame } from './auth-frame';

/** The API's minimum (AcceptInviteDto / ResetPasswordDto: `z.string().min(8)`). */
export const MIN_PASSWORD_LENGTH = 8;

export type SetPasswordMode = 'accept' | 'reset';

/**
 * W16: the pages behind the links the API mails to staff (C2): `/{lang}/admin/accept/{token}` (an
 * invitation) and `/{lang}/admin/reset/{token}` (a password reset). Both set a password with
 * `POST /admin/auth/accept|reset/:token`; the token is single-use, and an unknown, used or expired
 * one is a 400 "invalid or expired". Styled with the other signed-out staff pages (AdminAuthFrame).
 */
@Component({
  selector: 'app-admin-set-password',
  imports: [FormField, RouterLink, TranslocoPipe, Field, Control, Button, AdminAuthFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-auth-frame
      [heading]="'admin.setPassword.' + mode() + '.title' | transloco"
      [lead]="done() ? null : ('admin.setPassword.' + mode() + '.lead' | transloco)"
    >
      @if (done()) {
        <div class="card flex flex-col gap-5" role="status" tabindex="-1">
          <p class="m-0">{{ 'admin.setPassword.' + mode() + '.done' | transloco }}</p>
          <a appButton [routerLink]="locale.link('/admin/login')">{{
            'admin.setPassword.toLogin' | transloco
          }}</a>
        </div>
      } @else {
        <form class="card flex flex-col gap-5" novalidate (submit)="onSubmit($event)">
          <app-field
            [label]="'admin.setPassword.password' | transloco"
            [hint]="'admin.setPassword.hint' | transloco: { min: min }"
            [state]="model.password()"
            [forceErrors]="tried()"
          >
            <input
              appControl
              type="password"
              autocomplete="new-password"
              dir="ltr"
              [formField]="model.password"
            />
          </app-field>
          <app-field
            [label]="'admin.setPassword.confirm' | transloco"
            [state]="model.confirm()"
            [forceErrors]="tried()"
          >
            <input
              appControl
              type="password"
              autocomplete="new-password"
              dir="ltr"
              [formField]="model.confirm"
            />
          </app-field>
          @if (errorKey(); as key) {
            <p class="note note-warn" role="alert">{{ key | transloco }}</p>
          }
          <button appButton type="submit" [busy]="busy()" [disabled]="busy()">
            {{ 'admin.setPassword.' + mode() + '.submit' | transloco }}
          </button>
        </form>
      }
    </app-admin-auth-frame>
  `,
})
export class AdminSetPassword {
  /** Route param. */
  readonly token = input.required<string>();
  /** Route data. */
  readonly mode = input.required<SetPasswordMode>();

  private readonly api = inject(StaffApi);
  private readonly t = inject(TranslocoService);
  protected readonly locale = inject(LocaleService);
  protected readonly min = MIN_PASSWORD_LENGTH;

  protected readonly value = signal({ password: '', confirm: '' });
  protected readonly model = form(this.value, (p) => {
    required(p.password);
    minLength(p.password, MIN_PASSWORD_LENGTH, {
      message: this.t.translate('admin.setPassword.tooShort', { min: MIN_PASSWORD_LENGTH }),
    });
    required(p.confirm);
    validate(p.confirm, ({ value, valueOf }) =>
      value() && value() !== valueOf(p.password)
        ? { kind: 'mismatch', message: this.t.translate('admin.setPassword.mismatch') }
        : undefined,
    );
  });
  protected readonly busy = signal(false);
  protected readonly tried = signal(false);
  protected readonly done = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly call = computed(() =>
    this.mode() === 'accept'
      ? (token: string, password: string) => this.api.acceptInvite(token, password)
      : (token: string, password: string) => this.api.resetPassword(token, password),
  );

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
        await firstValueFrom(this.call()(this.token(), this.value().password));
        this.done.set(true);
        return undefined;
      } catch (error) {
        const problem = toApiProblem(error);
        const fieldErrors = problemToTreeErrors(this.model as never, problem);
        if (fieldErrors) {
          return fieldErrors;
        }
        // A 400 with no field issues is the API's "This link is invalid or has expired".
        this.errorKey.set(
          problem.status === 400 ? 'admin.setPassword.invalidLink' : problemMessageKey(problem),
        );
        return undefined;
      } finally {
        this.busy.set(false);
      }
    });
  }
}
