import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { type StaffSession, SystemApi } from '../../../core/api/admin/system-api';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { StaffSessionStore } from '../../../core/auth/staff-session.store';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { LocalDatePipe, RelTimePipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { Control, Field, type FieldErrorLike } from '../../../shared/ui/field/field';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';
import { AdminPageHead } from '../layout/admin-page-head';
import { MIN_PASSWORD_LENGTH } from '../auth/set-password';

/** A readable device label from a user agent ("Chrome · Windows"). */
export function deviceLabel(ua: string | null): string {
  if (!ua) return '—';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : '';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return [browser, os].filter(Boolean).join(' · ') || ua.slice(0, 60);
}

/**
 * My account (any staff member): change password (`PATCH admin/auth/password`; it ends every other
 * session) and the signed-in sessions (`GET/DELETE admin/auth/sessions`).
 */
@Component({
  selector: 'app-admin-account',
  imports: [TranslocoPipe, LocalDatePipe, RelTimePipe, Button, Field, Control, Icon, AdminPageHead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-admin-page-head
      [heading]="'admin.system.account.title' | transloco"
      [sub]="me()?.email ?? null"
    />
    <div class="grid gap-6 lg:grid-cols-2">
      <form
        class="card flex flex-col gap-5"
        novalidate
        (submit)="changePassword($event)"
        aria-labelledby="password-title"
      >
        <h2 class="t-h4 m-0 text-heading" id="password-title">
          {{ 'admin.system.account.password' | transloco }}
        </h2>
        <app-field
          [label]="'admin.system.account.current' | transloco"
          [required]="true"
          [errors]="err('current')"
          [forceErrors]="true"
        >
          <input
            appControl
            type="password"
            autocomplete="current-password"
            dir="ltr"
            [value]="current()"
            (input)="current.set($any($event.target).value)"
          />
        </app-field>
        <app-field
          [label]="'admin.setPassword.password' | transloco"
          [hint]="'admin.setPassword.hint' | transloco: { min: min }"
          [required]="true"
          [errors]="err('next')"
          [forceErrors]="true"
        >
          <input
            appControl
            type="password"
            autocomplete="new-password"
            dir="ltr"
            [value]="next()"
            (input)="next.set($any($event.target).value)"
          />
        </app-field>
        <app-field
          [label]="'admin.setPassword.confirm' | transloco"
          [required]="true"
          [errors]="err('confirm')"
          [forceErrors]="true"
        >
          <input
            appControl
            type="password"
            autocomplete="new-password"
            dir="ltr"
            [value]="confirm()"
            (input)="confirm.set($any($event.target).value)"
          />
        </app-field>
        <p class="t-small m-0 text-text-muted">
          {{ 'admin.system.account.endsOthers' | transloco }}
        </p>
        @if (errorKey(); as key) {
          <p class="note note-warn m-0" role="alert">{{ key | transloco }}</p>
        }
        <button appButton type="submit" class="self-start" [busy]="busy()" [disabled]="busy()">
          {{ 'admin.system.account.change' | transloco }}
        </button>
      </form>

      <section class="card flex flex-col gap-4" aria-labelledby="sessions-title">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="t-h4 m-0 text-heading" id="sessions-title">
            {{ 'admin.system.account.sessions' | transloco }}
          </h2>
          @if ((sessions.value() ?? []).length > 1) {
            <button
              appButton
              variant="line"
              size="sm"
              type="button"
              [disabled]="busy()"
              (click)="endOthers()"
            >
              {{ 'admin.system.account.endOthers' | transloco }}
            </button>
          }
        </div>
        @if (sessions.value(); as list) {
          <ul class="m-0 flex list-none flex-col gap-3 p-0" data-testid="session-rows">
            @for (s of list; track s.id) {
              <li class="flex flex-wrap items-center gap-3 rounded-card border border-border p-3">
                <app-icon name="monitor" [size]="20" class="text-decor" />
                <div class="flex min-w-0 flex-1 flex-col">
                  <span class="font-semibold text-heading" dir="ltr">{{
                    device(s.userAgent)
                  }}</span>
                  <span class="t-small text-text-muted">
                    {{
                      'admin.system.account.lastSeen'
                        | transloco: { time: (s.lastSeenAt | relTime) }
                    }}
                    ·
                    {{
                      'admin.system.account.since'
                        | transloco: { date: (s.createdAt | localDate: 'medium') }
                    }}
                  </span>
                </div>
                @if (s.isCurrent) {
                  <span class="pill pill-ok">{{
                    'admin.system.account.thisDevice' | transloco
                  }}</span>
                } @else {
                  <button
                    appButton
                    variant="line"
                    size="sm"
                    type="button"
                    [disabled]="busy()"
                    (click)="end(s)"
                  >
                    {{ 'admin.system.account.end' | transloco
                    }}<span class="sr-only">: {{ device(s.userAgent) }}</span>
                  </button>
                }
              </li>
            }
          </ul>
        } @else {
          <span class="skeleton block h-24" aria-hidden="true"></span>
        }
      </section>
    </div>
  `,
})
export class AdminAccount {
  private readonly api = inject(SystemApi);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  protected readonly me = inject(StaffSessionStore).me;
  protected readonly min = MIN_PASSWORD_LENGTH;
  protected readonly sessions = rxResource({ stream: () => this.api.sessions() });
  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly confirm = signal('');
  protected readonly busy = signal(false);
  protected readonly tried = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly wrongCurrent = signal(false);

  private readonly problems = computed<Record<string, FieldErrorLike[]>>(() => ({
    current: [
      ...(!this.current() ? [{ kind: 'required' }] : []),
      ...(this.wrongCurrent()
        ? [{ kind: 'server', message: this.t.translate('admin.system.account.wrongCurrent') }]
        : []),
    ],
    next: !this.next()
      ? [{ kind: 'required' }]
      : this.next().length < MIN_PASSWORD_LENGTH
        ? [
            {
              kind: 'min',
              message: this.t.translate('admin.setPassword.tooShort', { min: MIN_PASSWORD_LENGTH }),
            },
          ]
        : [],
    confirm:
      this.confirm() !== this.next()
        ? [{ kind: 'mismatch', message: this.t.translate('admin.setPassword.mismatch') }]
        : [],
  }));

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
  }

  protected err(key: 'current' | 'next' | 'confirm'): FieldErrorLike[] {
    return this.tried() || (key === 'current' && this.wrongCurrent()) ? this.problems()[key] : [];
  }

  protected device(ua: string | null): string {
    return deviceLabel(ua);
  }

  protected async changePassword(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    this.wrongCurrent.set(false);
    this.errorKey.set(null);
    if (Object.values(this.problems()).some((l) => l.length)) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.changePassword(this.current(), this.next()));
      this.current.set('');
      this.next.set('');
      this.confirm.set('');
      this.tried.set(false);
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.system.account.changed'),
      });
      this.sessions.reload();
    } catch (error) {
      const problem = toApiProblem(error);
      if (problem.status === 401) this.wrongCurrent.set(true);
      else this.errorKey.set(problemMessageKey(problem));
    } finally {
      this.busy.set(false);
    }
  }

  protected async end(s: StaffSession): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.endSession(s.id));
      this.sessions.update((list) => (list ?? []).filter((x) => x.id !== s.id));
    } catch (error) {
      this.toasts.show({
        kind: 'error',
        message: this.t.translate(problemMessageKey(toApiProblem(error))),
      });
    } finally {
      this.busy.set(false);
    }
  }

  protected async endOthers(): Promise<void> {
    this.busy.set(true);
    try {
      const { ended } = await firstValueFrom(this.api.endOtherSessions());
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.system.account.ended', { count: ended }),
      });
      this.sessions.reload();
    } catch (error) {
      this.toasts.show({
        kind: 'error',
        message: this.t.translate(problemMessageKey(toApiProblem(error))),
      });
    } finally {
      this.busy.set(false);
    }
  }
}
