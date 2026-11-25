import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SystemApi } from '../../../core/api/admin/system-api';
import type { PermissionCatalog, StaffRoleDetail } from '../../../core/api/models';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { WILDCARD, type PermissionKey } from '../../../core/auth/permissions';
import { roleName } from '../../../core/auth/role-name';
import { StaffSessionStore } from '../../../core/auth/staff-session.store';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { DigitsPipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { DialogFrame, DialogService } from '../../../shared/ui/dialog/dialog';
import { Control, Field, type FieldErrorLike } from '../../../shared/ui/field/field';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';
import { AdminPageHead } from '../layout/admin-page-head';
import { confirmAction } from '../shared/confirm-dialog';
import {
  ACTIONS,
  RESERVED_ROLE_KEYS,
  ROLE_KEY_PATTERN,
  toggleAction,
  type Action,
} from './roles-rules';

export interface RoleFormData {
  /** Absent → create. */
  role?: StaffRoleDetail;
  catalog: PermissionCatalog;
  /** The admin role, or the signed-in user's own role: shown, not editable. */
  readOnly: boolean;
  readOnlyReason: 'admin' | 'own' | null;
}

/**
 * Create or edit a role (`POST/PATCH admin/roles`): names, descriptions, the key (create only) and the
 * permission grid. A permission the signed-in user doesn't hold is disabled (the API refuses to grant
 * it: no escalation).
 */
@Component({
  selector: 'app-role-form',
  imports: [TranslocoPipe, Button, DialogFrame, Field, Control, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame
      [heading]="
        (data.role
          ? data.readOnly
            ? 'admin.system.roles.view'
            : 'admin.system.roles.edit'
          : 'admin.system.roles.add'
        ) | transloco
      "
      headingId="role-form-title"
    >
      <form class="flex flex-col gap-5" id="role-form" novalidate (submit)="save($event)">
        @if (data.readOnlyReason; as reason) {
          <p class="note m-0" data-testid="role-readonly">
            {{
              (reason === 'admin'
                ? 'admin.system.roles.adminReadOnly'
                : 'admin.system.roles.ownRole'
              ) | transloco
            }}
          </p>
        }
        <div class="grid gap-5 md:grid-cols-2">
          <app-field
            [label]="'admin.system.roles.nameAr' | transloco"
            [required]="true"
            [errors]="err('nameAr')"
            [forceErrors]="true"
          >
            <input
              appControl
              dir="rtl"
              lang="ar"
              maxlength="120"
              data-testid="role-name-ar"
              [disabled]="data.readOnly"
              [value]="nameAr()"
              (input)="nameAr.set($any($event.target).value)"
            />
          </app-field>
          <app-field [label]="'admin.system.roles.nameEn' | transloco" [errors]="err('nameEn')">
            <input
              appControl
              dir="ltr"
              lang="en"
              maxlength="120"
              data-testid="role-name-en"
              [disabled]="data.readOnly"
              [value]="nameEn()"
              (input)="nameEn.set($any($event.target).value)"
            />
          </app-field>
          <app-field
            [label]="'admin.system.roles.descriptionAr' | transloco"
            [errors]="err('descriptionAr')"
          >
            <textarea
              appControl
              dir="rtl"
              lang="ar"
              rows="2"
              maxlength="500"
              [disabled]="data.readOnly"
              [value]="descriptionAr()"
              (input)="descriptionAr.set($any($event.target).value)"
            ></textarea>
          </app-field>
          <app-field
            [label]="'admin.system.roles.descriptionEn' | transloco"
            [errors]="err('descriptionEn')"
          >
            <textarea
              appControl
              dir="ltr"
              lang="en"
              rows="2"
              maxlength="500"
              [disabled]="data.readOnly"
              [value]="descriptionEn()"
              (input)="descriptionEn.set($any($event.target).value)"
            ></textarea>
          </app-field>
          @if (!data.role) {
            <app-field
              [label]="'admin.system.roles.key' | transloco"
              [hint]="'admin.system.roles.keyHint' | transloco"
              [errors]="err('key')"
              [forceErrors]="true"
            >
              <input
                appControl
                dir="ltr"
                maxlength="64"
                autocomplete="off"
                spellcheck="false"
                data-testid="role-key"
                [value]="key()"
                (input)="key.set($any($event.target).value)"
              />
            </app-field>
          }
        </div>

        <fieldset class="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend class="t-h5 mb-1 p-0 text-heading">
            {{ 'admin.system.roles.permissions' | transloco }}
          </legend>
          @if (!data.readOnly) {
            <p class="t-small m-0 text-text-muted">
              {{ 'admin.system.roles.permissionsLead' | transloco }}
            </p>
          }
          @for (g of data.catalog.groups; track g.key) {
            <div
              class="card card-flush relative overflow-x-auto"
              tabindex="0"
              role="region"
              [attr.aria-label]="pickLabel(g)"
            >
              <table class="w-full border-collapse text-start" [attr.data-group]="g.key">
                <thead class="bg-thead">
                  <tr>
                    <th scope="col" class="t-small px-3 py-2 text-start font-semibold text-heading">
                      {{ pickLabel(g) }}
                    </th>
                    @for (a of actions; track a) {
                      <th
                        scope="col"
                        class="t-small w-20 px-2 py-2 text-center font-semibold text-text-muted"
                      >
                        {{ 'admin.system.roles.actions.' + a | transloco }}
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (m of g.modules; track m.key) {
                    <tr class="border-t border-border" [attr.data-module]="m.key">
                      <th scope="row" class="px-3 py-1 text-start font-medium">
                        {{ pickLabel(m) }}
                      </th>
                      @for (a of actions; track a) {
                        <td class="px-2 py-1 text-center">
                          @if (m.actions.includes(a)) {
                            <label
                              class="inline-flex size-11 cursor-pointer items-center justify-center"
                              [attr.title]="
                                !data.readOnly && !holds(m.key, a)
                                  ? ('admin.system.roles.notHeld' | transloco)
                                  : null
                              "
                            >
                              <input
                                type="checkbox"
                                class="size-5 accent-primary"
                                [attr.data-permission]="m.key + '.' + a"
                                [checked]="granted().has(m.key + '.' + a)"
                                [disabled]="data.readOnly || busy() || !holds(m.key, a)"
                                (change)="toggle(m.key, m.actions, a, $any($event.target).checked)"
                              />
                              <span class="sr-only"
                                >{{ pickLabel(m) }}:
                                {{ 'admin.system.roles.actions.' + a | transloco }}</span
                              >
                            </label>
                          } @else {
                            <span class="text-decor" aria-hidden="true">—</span>
                            <span class="sr-only">{{
                              'admin.system.roles.notAvailable' | transloco
                            }}</span>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </fieldset>
        @if (errorKey(); as key) {
          <p class="note note-warn m-0" role="alert">{{ key | transloco }}</p>
        }
      </form>
      <button dialogActions appButton variant="ghost" type="button" (click)="ref.close()">
        {{ (data.readOnly ? 'common.close' : 'common.cancel') | transloco }}
      </button>
      @if (!data.readOnly) {
        <button
          dialogActions
          appButton
          type="submit"
          form="role-form"
          data-testid="role-save"
          [busy]="busy()"
          [disabled]="busy()"
        >
          <app-icon name="check" [size]="18" />{{ 'common.save' | transloco }}
        </button>
      }
    </app-dialog-frame>
  `,
})
export class RoleForm {
  protected readonly data = inject<RoleFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<StaffRoleDetail>>(DialogRef);
  private readonly api = inject(SystemApi);
  private readonly store = inject(StaffSessionStore);
  private readonly locale = inject(LocaleService);
  protected readonly actions = ACTIONS;
  protected readonly nameAr = signal(this.data.role?.nameAr ?? '');
  protected readonly nameEn = signal(this.data.role?.nameEn ?? '');
  protected readonly descriptionAr = signal(this.data.role?.descriptionAr ?? '');
  protected readonly descriptionEn = signal(this.data.role?.descriptionEn ?? '');
  protected readonly key = signal('');
  protected readonly granted = signal<ReadonlySet<string>>(this.initialGrants());
  protected readonly busy = signal(false);
  protected readonly tried = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly server = signal<Record<string, string[]>>({});

  /** The admin role's `*` shows as every box ticked. */
  private initialGrants(): ReadonlySet<string> {
    const held = this.data.role?.permissions ?? [];
    if (!held.includes(WILDCARD)) return new Set(held);
    return new Set(
      this.data.catalog.groups.flatMap((g) =>
        g.modules.flatMap((m) => m.actions.map((a) => `${m.key}.${a}`)),
      ),
    );
  }

  protected pickLabel(x: { labelAr: string; labelEn: string }): string {
    return this.locale.lang() === 'en' ? x.labelEn || x.labelAr : x.labelAr;
  }

  protected holds(module: string, action: Action): boolean {
    return this.store.can(`${module}.${action}` as PermissionKey);
  }

  protected toggle(module: string, actions: readonly Action[], action: Action, on: boolean): void {
    const next = toggleAction(this.granted(), module, actions, action, on);
    // Never tick something the signed-in user can't grant (ticking delete would imply it).
    for (const key of next) {
      if (!this.granted().has(key) && !this.store.can(key as PermissionKey)) next.delete(key);
    }
    this.granted.set(next);
  }

  protected err(
    field: 'nameAr' | 'nameEn' | 'descriptionAr' | 'descriptionEn' | 'key',
  ): FieldErrorLike[] {
    const out: FieldErrorLike[] = [];
    if (field === 'nameAr' && this.tried() && !this.nameAr().trim()) out.push({ kind: 'required' });
    if (field === 'key' && this.tried()) {
      const k = this.key().trim();
      if (k && RESERVED_ROLE_KEYS.includes(k))
        out.push({ kind: 'server', message: this.t('admin.system.roles.keyReserved') });
      else if (k && !ROLE_KEY_PATTERN.test(k))
        out.push({ kind: 'server', message: this.t('admin.system.roles.keyInvalid') });
    }
    return [
      ...out,
      ...(this.server()[field] ?? []).map((message) => ({ kind: 'server', message })),
    ];
  }

  private readonly transloco = inject(TranslocoService);
  private t(key: string): string {
    return this.transloco.translate(key);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.data.readOnly) return;
    this.tried.set(true);
    this.errorKey.set(null);
    this.server.set({});
    if (['nameAr', 'key'].some((f) => this.err(f as 'nameAr' | 'key').length)) return;
    this.busy.set(true);
    const body = {
      nameAr: this.nameAr().trim(),
      nameEn: this.nameEn().trim() || null,
      descriptionAr: this.descriptionAr().trim() || null,
      descriptionEn: this.descriptionEn().trim() || null,
      permissions: [...this.granted()],
    };
    try {
      const role = this.data.role;
      const key = this.key().trim();
      const saved = role
        ? await firstValueFrom(this.api.updateRole(role.id, body))
        : await firstValueFrom(this.api.createRole({ ...body, ...(key ? { key } : {}) }));
      this.ref.close(saved);
    } catch (error) {
      const problem = toApiProblem(error);
      if (problem.code === 'ROLE_KEY_TAKEN') {
        this.server.set({ key: [this.t('errors.codes.ROLE_KEY_TAKEN')] });
      } else {
        this.server.set(problem.fieldErrors);
        this.errorKey.set(problemMessageKey(problem));
      }
    } finally {
      this.busy.set(false);
    }
  }
}

/**
 * System → Roles (safeer_api v1.1.0): every role with its user count and how much it can do. New and
 * Edit need `roles.manage`, Delete `roles.delete`. System roles are badged; `admin` is read-only and no
 * system role can be deleted. Your own role opens read-only (the API refuses to edit it).
 */
@Component({
  selector: 'app-admin-roles',
  imports: [TranslocoPipe, DigitsPipe, Button, Icon, AdminPageHead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-admin-page-head
      [heading]="'admin.system.roles.title' | transloco"
      [sub]="
        roles.value()
          ? ('admin.system.roles.count' | transloco: { count: (roles.value()!.length | digits) })
          : null
      "
    >
      @if (canManage()) {
        <button
          pageActions
          appButton
          size="sm"
          type="button"
          data-testid="role-add"
          [disabled]="!catalog.value()"
          (click)="create()"
        >
          <app-icon name="plus" [size]="18" />{{ 'admin.system.roles.add' | transloco }}
        </button>
      }
    </app-admin-page-head>
    <p class="t-small mt-0 mb-6 max-w-3xl text-text-muted">
      {{ 'admin.system.roles.lead' | transloco }}
    </p>

    @if (roles.error() || catalog.error()) {
      <p class="note note-warn" role="alert">{{ 'admin.common.loadError' | transloco }}</p>
    } @else if (roles.value(); as list) {
      <ul class="m-0 flex list-none flex-col gap-2 p-0" data-testid="role-rows">
        @for (r of list; track r.id) {
          <li class="card flex flex-wrap items-center gap-4 p-3 md:p-4" [attr.data-role]="r.key">
            <span class="icon-tile size-11 shrink-0" aria-hidden="true">
              <app-icon [name]="r.isSystem ? 'shield-check' : 'shield'" [size]="20" />
            </span>
            <div class="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
              <strong class="truncate text-heading">{{ name(r) }}</strong>
              @if (description(r); as d) {
                <span class="t-small text-text-muted">{{ d }}</span>
              }
              <span class="t-caption text-text-muted" dir="ltr">{{ r.key }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              @if (r.isSystem) {
                <span class="pill pill-plain" data-testid="role-system">{{
                  'admin.system.roles.system' | transloco
                }}</span>
              }
              <span class="pill pill-plain">{{
                isAll(r)
                  ? ('admin.system.roles.all' | transloco)
                  : ('admin.system.roles.permissionsCount'
                    | transloco: { count: (r.permissions.length | digits) })
              }}</span>
              <span class="pill pill-plain" data-testid="role-users">{{
                'admin.system.roles.users' | transloco: { count: (r.userCount | digits) }
              }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-1">
              <button
                appButton
                variant="link"
                size="sm"
                type="button"
                data-testid="role-open"
                [disabled]="!catalog.value()"
                (click)="open(r)"
              >
                {{
                  (editable(r) ? 'admin.content.editShort' : 'admin.system.roles.view') | transloco
                }}<span class="sr-only">: {{ name(r) }}</span>
              </button>
              @if (canDelete() && !r.isSystem && r.id !== myRoleId()) {
                <button
                  type="button"
                  class="icon-btn size-11 text-alert"
                  data-testid="role-delete"
                  [attr.aria-label]="('admin.common.delete' | transloco) + ': ' + name(r)"
                  [disabled]="busy()"
                  (click)="remove(r)"
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
  `,
})
export class AdminRoles {
  private readonly api = inject(SystemApi);
  private readonly store = inject(StaffSessionStore);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  protected readonly busy = signal(false);
  protected readonly canManage = computed(() => this.store.can('roles.manage'));
  protected readonly canDelete = computed(() => this.store.can('roles.delete'));
  protected readonly myRoleId = computed(() => this.store.me()?.role.id ?? null);
  protected readonly roles = rxResource({ stream: () => this.api.roles() });
  protected readonly catalog = rxResource({ stream: () => this.api.permissionCatalog() });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
  }

  protected name(r: StaffRoleDetail): string {
    return roleName(r, this.locale.lang());
  }

  protected description(r: StaffRoleDetail): string | null {
    return (this.locale.lang() === 'en' && r.descriptionEn?.trim()) || r.descriptionAr || null;
  }

  protected isAll(r: StaffRoleDetail): boolean {
    return r.permissions.includes(WILDCARD);
  }

  protected editable(r: StaffRoleDetail): boolean {
    return this.canManage() && r.key !== 'admin' && r.id !== this.myRoleId();
  }

  protected async create(): Promise<void> {
    const saved = await this.openForm({
      catalog: this.catalog.value()!,
      readOnly: false,
      readOnlyReason: null,
    });
    if (saved) {
      this.roles.update((list) => [...(list ?? []), saved]);
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.system.roles.created', { name: this.name(saved) }),
      });
    }
  }

  protected async open(r: StaffRoleDetail): Promise<void> {
    const reason = r.key === 'admin' ? 'admin' : r.id === this.myRoleId() ? 'own' : null;
    const saved = await this.openForm({
      role: r,
      catalog: this.catalog.value()!,
      readOnly: !this.editable(r),
      readOnlyReason: reason,
    });
    if (saved) {
      this.roles.update((list) => (list ?? []).map((x) => (x.id === saved.id ? saved : x)));
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.saved') });
    }
  }

  private async openForm(data: RoleFormData): Promise<StaffRoleDetail | undefined> {
    const ref = this.dialogs.open<StaffRoleDetail, RoleFormData>(RoleForm, {
      data,
      ariaLabelledBy: 'role-form-title',
      disableClose: !data.readOnly,
      width: 'min(760px, calc(100vw - 32px))',
    });
    return firstValueFrom(ref.closed);
  }

  protected async remove(r: StaffRoleDetail): Promise<void> {
    if (r.userCount > 0) {
      this.toasts.show({
        kind: 'error',
        message: this.t.translate('admin.system.roles.inUse', {
          name: this.name(r),
          count: r.userCount,
        }),
      });
      return;
    }
    const ok = await confirmAction(this.dialogs, {
      heading: this.t.translate('admin.common.confirmDelete'),
      body: this.t.translate('admin.system.roles.deleteConfirm', { name: this.name(r) }),
      confirm: this.t.translate('admin.common.delete'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteRole(r.id));
      this.roles.update((list) => (list ?? []).filter((x) => x.id !== r.id));
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.deleted') });
    } catch (error) {
      const problem = toApiProblem(error);
      const count = (problem as { extra?: { userCount?: number } }).extra?.userCount;
      this.toasts.show({
        kind: 'error',
        message:
          problem.code === 'ROLE_IN_USE' && typeof count === 'number'
            ? this.t.translate('admin.system.roles.inUse', { name: this.name(r), count })
            : this.t.translate(problemMessageKey(problem)),
      });
    } finally {
      this.busy.set(false);
    }
  }
}
