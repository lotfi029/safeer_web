import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { StaffSessionStore } from '../../../core/auth/staff-session.store';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { Button } from '../../../shared/ui/button/button';
import { Control, Field } from '../../../shared/ui/field/field';

/**
 * Stub staff login (Session 1 scope: exercises StaffSessionStore + guards). Session 2 builds the
 * designed login/forgot/reset/accept screens on top of the same store.
 */
@Component({
  selector: 'app-admin-login',
  imports: [FormField, TranslocoPipe, Field, Control, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      id="main"
      class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-12"
    >
      <h1 class="t-h2">{{ 'admin.login.title' | transloco }}</h1>
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
      </form>
    </main>
  `,
})
export class AdminLogin {
  readonly returnUrl = input<string | undefined>();
  private readonly store = inject(StaffSessionStore);
  private readonly router = inject(Router);
  private readonly locale = inject(LocaleService);

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
        this.errorKey.set(
          problem.status === 401 ? 'admin.login.invalid' : problemMessageKey(problem),
        );
      } finally {
        this.busy.set(false);
      }
      return undefined;
    });
  }
}
