import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SystemApi } from '../../../core/api/admin/system-api';
import type { StaffRole, StaffUser } from '../../../core/api/models';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { StaffSessionStore } from '../../../core/auth/staff-session.store';
import type { StaffArea } from '../../../core/auth/role-matrix';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { DigitsPipe, LocalDatePipe, RelTimePipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { DialogFrame, DialogService } from '../../../shared/ui/dialog/dialog';
import { Control, Field, type FieldErrorLike } from '../../../shared/ui/field/field';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';
import { AdminPageHead } from '../layout/admin-page-head';
import { confirmAction } from '../shared/confirm-dialog';

const ROLES: readonly StaffRole[] = ['admin', 'reviewer', 'editor', 'support'];
const AREAS: readonly StaffArea[] = [
  'applications',
  'applications.delete',
  'content',
  'redirects.delete',
  'inbox',
  'inbox.delete',
  'users',
  'settings',
  'audit',
];

export interface UserFormData {
  /** Absent → invite. */
  user?: StaffUser;
  self: boolean;
}

/** Invite (`POST admin/auth/invite`) or edit (`PATCH admin/users/:id`: name, email, role, status). */
@Component({
  selector: 'app-user-form',
  imports: [TranslocoPipe, Button, DialogFrame, Field, Control],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame
      [heading]="(data.user ? 'admin.system.users.edit' : 'admin.system.users.invite') | transloco"
      headingId="user-form-title"
    >
      <form class="flex flex-col gap-5" id="user-form" novalidate (submit)="save($event)">
        <app-field
          [label]="'admin.system.users.name' | transloco"
          [required]="true"
          [errors]="err('name')"
          [forceErrors]="true"
        >
          <input
            appControl
            maxlength="120"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
          />
        </app-field>
        <app-field
          [label]="'admin.system.users.email' | transloco"
          [required]="true"
          [errors]="err('email')"
          [forceErrors]="true"
        >
          <input
            appControl
            type="email"
            dir="ltr"
            maxlength="191"
            [value]="email()"
            (input)="email.set($any($event.target).value)"
          />
        </app-field>
        <app-field
          [label]="'admin.system.users.role' | transloco"
          [hint]="data.self ? ('admin.system.users.ownRole' | transloco) : null"
        >
          <select appControl [disabled]="data.self" (change)="role.set($any($event.target).value)">
            @for (r of roles; track r) {
              <option [value]="r" [selected]="r === role()">
                {{ 'admin.shell.roles.' + r | transloco }}
              </option>
            }
          </select>
        </app-field>
        @if (data.user && data.user.status !== 'invited') {
          <label class="check">
            <input
              type="checkbox"
              [checked]="disabled()"
              (change)="disabled.set($any($event.target).checked)"
            />
            <span>{{ 'admin.system.users.disableAccount' | transloco }}</span>
          </label>
        }
        @if (!data.user) {
          <p class="t-small m-0 text-text-muted">
            {{ 'admin.system.users.inviteLead' | transloco }}
          </p>
        }
        @if (errorKey(); as key) {
          <p class="note note-warn m-0" role="alert">{{ key | transloco }}</p>
        }
      </form>
      <button dialogActions appButton variant="ghost" type="button" (click)="ref.close()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        dialogActions
        appButton
        type="submit"
        form="user-form"
        [busy]="busy()"
        [disabled]="busy()"
      >
        {{ (data.user ? 'common.save' : 'admin.system.users.sendInvite') | transloco }}
      </button>
    </app-dialog-frame>
  `,
})
export class UserForm {
  protected readonly data = inject<UserFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<StaffUser>>(DialogRef);
  private readonly api = inject(SystemApi);
  protected readonly roles = ROLES;
  protected readonly name = signal(this.data.user?.name ?? '');
  protected readonly email = signal(this.data.user?.email ?? '');
  protected readonly role = signal<StaffRole>(this.data.user?.role ?? 'editor');
  protected readonly disabled = signal(this.data.user?.status === 'disabled');
  protected readonly busy = signal(false);
  protected readonly tried = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly server = signal<Record<string, string[]>>({});

  protected err(key: 'name' | 'email'): FieldErrorLike[] {
    const out: FieldErrorLike[] = [];
    const v = (key === 'name' ? this.name() : this.email()).trim();
    if (this.tried() && !v) out.push({ kind: 'required' });
    if (this.tried() && key === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))
      out.push({ kind: 'email' });
    return [...out, ...(this.server()[key] ?? []).map((message) => ({ kind: 'server', message }))];
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    this.errorKey.set(null);
    this.server.set({});
    if (this.err('name').length || this.err('email').length) return;
    this.busy.set(true);
    try {
      const u = this.data.user;
      const saved = u
        ? await firstValueFrom(
            this.api.updateUser(u.id, {
              ...(this.name().trim() !== u.name ? { name: this.name().trim() } : {}),
              ...(this.email().trim() !== u.email ? { email: this.email().trim() } : {}),
              ...(this.role() !== u.role ? { role: this.role() } : {}),
              ...(u.status !== 'invited' && (this.disabled() ? 'disabled' : 'active') !== u.status
                ? { status: this.disabled() ? 'disabled' : 'active' }
                : {}),
            } as never),
          )
        : await firstValueFrom(
            this.api.invite({
              name: this.name().trim(),
              email: this.email().trim(),
              role: this.role(),
            }),
          );
      this.ref.close(saved);
    } catch (error) {
      const problem = toApiProblem(error);
      this.server.set(problem.fieldErrors);
      this.errorKey.set(
        problem.status === 409 && problem.code === 'VALIDATION_FAILED' && !this.data.user
          ? 'admin.system.users.exists'
          : problemMessageKey(problem),
      );
    } finally {
      this.busy.set(false);
    }
  }
}

/**
 * Users and permissions (prototype `aUsers`): staff with role, status (active / disabled / invited)
 * and brute-force lock; invite, edit, unlock, delete; and the role matrix from `GET /admin/roles`.
 * The API guards the last active admin (LAST_ADMIN) and your own role and account.
 */
@Component({
  selector: 'app-admin-users',
  imports: [TranslocoPipe, DigitsPipe, LocalDatePipe, RelTimePipe, Button, Icon, AdminPageHead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-admin-page-head
      [heading]="'admin.system.users.title' | transloco"
      [sub]="
        users.value()
          ? ('admin.system.users.count' | transloco: { count: (users.value()!.length | digits) })
          : null
      "
    >
      <button pageActions appButton size="sm" type="button" (click)="invite()">
        <app-icon name="user-plus" [size]="18" />{{ 'admin.system.users.invite' | transloco }}
      </button>
    </app-admin-page-head>

    @if (users.error()) {
      <p class="note note-warn" role="alert">{{ 'admin.common.loadError' | transloco }}</p>
    } @else if (users.value(); as list) {
      <ul class="m-0 flex list-none flex-col gap-2 p-0" data-testid="user-rows">
        @for (u of list; track u.id) {
          <li class="card flex flex-wrap items-center gap-4 p-3 md:p-4" [attr.data-user]="u.email">
            <span class="icon-tile size-11 shrink-0 font-bold" aria-hidden="true">{{
              initial(u.name)
            }}</span>
            <div class="flex min-w-0 flex-1 basis-56 flex-col">
              <strong class="truncate text-heading">{{ u.name }}</strong>
              <span class="t-small truncate text-text-muted" dir="ltr">{{ u.email }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="pill pill-plain">{{ 'admin.shell.roles.' + u.role | transloco }}</span>
              <span
                class="pill"
                [class.pill-ok]="u.status === 'active'"
                [class.pill-warn]="u.status === 'disabled'"
                [class.pill-plain]="u.status === 'invited'"
                data-testid="user-status"
                >{{ 'admin.system.users.status.' + u.status | transloco }}</span
              >
              @if (u.isLocked) {
                <span class="pill pill-warn" data-testid="user-locked">
                  <app-icon name="lock" [size]="14" />
                  {{
                    'admin.system.users.lockedUntil'
                      | transloco: { time: (u.lockedUntil | localDate: 'datetime') }
                  }}
                </span>
              }
              <span class="t-caption text-text-muted">{{
                u.lastLoginAt
                  ? ('admin.system.users.lastLogin'
                    | transloco: { time: (u.lastLoginAt | relTime) })
                  : ('admin.system.users.never' | transloco)
              }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-1">
              @if (u.isLocked) {
                <button
                  appButton
                  variant="soft"
                  size="sm"
                  type="button"
                  [disabled]="busy()"
                  (click)="unlock(u)"
                >
                  <app-icon name="lock-open" [size]="16" />{{
                    'admin.system.users.unlock' | transloco
                  }}<span class="sr-only">: {{ u.name }}</span>
                </button>
              }
              <button appButton variant="link" size="sm" type="button" (click)="edit(u)">
                {{ 'admin.content.editShort' | transloco
                }}<span class="sr-only">: {{ u.name }}</span>
              </button>
              @if (u.id !== meId()) {
                <button
                  type="button"
                  class="icon-btn size-11 text-alert"
                  [attr.aria-label]="('admin.common.delete' | transloco) + ': ' + u.name"
                  [disabled]="busy()"
                  (click)="remove(u)"
                >
                  <app-icon name="trash-2" [size]="18" />
                </button>
              }
            </div>
          </li>
        }
      </ul>
    } @else {
      <span class="skeleton block h-40" aria-hidden="true"></span>
    }

    <section class="mt-10 flex flex-col gap-4" aria-labelledby="matrix-title">
      <h2 class="t-h4 m-0 text-heading" id="matrix-title">
        {{ 'admin.system.users.matrix' | transloco }}
      </h2>
      <div
        class="card card-flush relative overflow-x-auto"
        tabindex="0"
        role="region"
        [attr.aria-label]="'admin.system.users.matrix' | transloco"
      >
        <table class="w-full border-collapse text-start" data-testid="role-matrix">
          <thead class="bg-thead">
            <tr>
              <th scope="col" class="t-small px-4 py-3 text-start font-semibold text-text-muted">
                {{ 'admin.system.users.permission' | transloco }}
              </th>
              @for (r of roles; track r) {
                <th scope="col" class="t-small px-4 py-3 text-center font-semibold text-text-muted">
                  {{ 'admin.shell.roles.' + r | transloco }}
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (a of areas; track a) {
              <tr class="border-t border-border">
                <th scope="row" class="px-4 py-3 text-start font-medium">
                  {{ 'admin.system.areas.' + a | transloco }}
                </th>
                @for (r of roles; track r) {
                  <td class="px-4 py-3 text-center">
                    @if (allowed(a, r)) {
                      <app-icon name="check" [size]="18" class="text-success" />
                      <span class="sr-only">{{ 'admin.system.users.allowed' | transloco }}</span>
                    } @else {
                      <app-icon name="x" [size]="18" class="text-decor" />
                      <span class="sr-only">{{ 'admin.system.users.denied' | transloco }}</span>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="note m-0">{{ 'admin.system.users.applicantData' | transloco }}</p>
    </section>
  `,
})
export class AdminUsers {
  private readonly api = inject(SystemApi);
  private readonly store = inject(StaffSessionStore);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  protected readonly roles = ROLES;
  protected readonly areas = AREAS;
  protected readonly busy = signal(false);
  protected readonly meId = computed(() => this.store.me()?.id ?? null);
  protected readonly users = rxResource({ stream: () => this.api.users() });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
  }

  protected allowed(area: StaffArea, role: StaffRole): boolean {
    return (this.store.matrix()[area] ?? []).includes(role);
  }

  protected initial(name: string): string {
    const first = name.trim()[0] ?? '';
    return /\p{L}/u.test(first) ? first : '•';
  }

  private fail(error: unknown): void {
    this.toasts.show({
      kind: 'error',
      message: this.t.translate(problemMessageKey(toApiProblem(error))),
    });
  }

  private replace(saved: StaffUser): void {
    this.users.update((list) => (list ?? []).map((u) => (u.id === saved.id ? saved : u)));
  }

  protected async invite(): Promise<void> {
    const ref = this.dialogs.open<StaffUser, UserFormData>(UserForm, {
      data: { self: false },
      ariaLabelledBy: 'user-form-title',
      disableClose: true,
    });
    const created = await firstValueFrom(ref.closed);
    if (created) {
      this.users.update((list) => [...(list ?? []), created]);
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.system.users.invited', { email: created.email }),
      });
    }
  }

  protected async edit(u: StaffUser): Promise<void> {
    const ref = this.dialogs.open<StaffUser, UserFormData>(UserForm, {
      data: { user: u, self: u.id === this.meId() },
      ariaLabelledBy: 'user-form-title',
      disableClose: true,
    });
    const saved = await firstValueFrom(ref.closed);
    if (saved) {
      this.replace(saved);
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.saved') });
    }
  }

  protected async unlock(u: StaffUser): Promise<void> {
    this.busy.set(true);
    try {
      this.replace(await firstValueFrom(this.api.updateUser(u.id, { unlock: true })));
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.system.users.unlocked', { name: u.name }),
      });
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(u: StaffUser): Promise<void> {
    const ok = await confirmAction(this.dialogs, {
      heading: this.t.translate('admin.common.confirmDelete'),
      body: this.t.translate('admin.system.users.deleteConfirm', { name: u.name }),
      confirm: this.t.translate('admin.common.delete'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteUser(u.id));
      this.users.update((list) => (list ?? []).filter((x) => x.id !== u.id));
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.deleted') });
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }
}
