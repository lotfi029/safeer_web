import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { StaffSessionStore } from '../../../core/auth/staff-session.store';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { Button } from '../../../shared/ui/button/button';
import { Control, Field } from '../../../shared/ui/field/field';
import { AdminAuthFrame } from './auth-frame';

/**
 * Maps a failed sign-in to a message. The API answers a wrong password, an unknown email, a disabled
 * account and a locked account with the same 401 (A2/C3: nothing reveals which), so the screen has
 * one message for all of them; only the per-email limiter's 429 differs.
 */
export function loginErrorKey(status: number, code: string): string {
  if (status === 401) return 'admin.login.invalid';
  if (status === 429) return 'admin.login.rateLimited';
  return problemMessageKey({ code });
}

/** Staff sign-in (`POST /admin/auth/login`), then back to `returnUrl` or the overview. */
@Component({
  selector: 'app-admin-login',
  imports: [FormField, RouterLink, TranslocoPipe, Field, Control, Button, AdminAuthFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-auth-frame
      [heading]="'admin.login.title' | transloco"
      [lead]="'admin.login.lead' | transloco"
    >
      <form class="card flex flex-col gap-5" novalidate (submit)="onSubmit($event)">
        <app-field
          [label]="'admin.login.email' | transloco"
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
        <app-field
          [label]="'admin.login.password' | transloco"
          [state]="model.password()"
          [forceErrors]="tried()"
        >
          <input
            appControl
            type="password"
            autocomplete="current-password"
            dir="ltr"
            [formField]="model.password"
          />
        </app-field>
        @if (errorKey(); as key) {
          <p class="note note-warn" role="alert">{{ key | transloco }}</p>
        }
        <button appButton type="submit" [busy]="busy()" [disabled]="busy()">
          {{ 'admin.login.submit' | transloco }}
        </button>
        <a class="self-start font-semibold" [routerLink]="locale.link('/admin/forgot')">{{
          'admin.login.forgot' | transloco
        }}</a>
      </form>
    </app-admin-auth-frame>
  `,
})
export class AdminLogin {
  readonly returnUrl = input<string | undefined>();
  private readonly store = inject(StaffSessionStore);
  private readonly router = inject(Router);
  protected readonly locale = inject(LocaleService);

  protected readonly credentials = signal({ email: '', password: '' });
  protected readonly model = form(this.credentials, (p) => {
    required(p.email);
    email(p.email);
    required(p.password);
  });
  protected readonly busy = signal(false);
  protected readonly tried = signal(false);
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
        const { email: address, password } = this.credentials();
        await this.store.login(address, password);
        const target = this.returnUrl();
        await this.router.navigateByUrl(
          target?.startsWith('/') && !target.startsWith('//') ? target : this.locale.link('/admin'),
        );
      } catch (error) {
        const problem = toApiProblem(error);
        this.errorKey.set(loginErrorKey(problem.status, problem.code));
      } finally {
        this.busy.set(false);
      }
      return undefined;
    });
  }
}
