import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { type AuditRow, SystemApi } from '../../../core/api/admin/system-api';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { LocalDatePipe } from '../../../shared/pipes/format';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { AdminPageHead } from '../layout/admin-page-head';

const PAGE = 50;
/** Entity types the API audits (audit.interceptor.ts and the services that set auditContext). */
export const AUDIT_ENTITIES = [
  'applications',
  'users',
  'sessions',
  'site_settings',
  'mail_settings',
  'mail_templates',
  'mail_log',
  'sms_settings',
  'sms_templates',
  'redirects',
  'interview_slots',
  'newsletter_subscribers',
  'contact_messages',
  'posts',
  'pages',
  'page_sections',
  'media_assets',
  'cache',
] as const;

export interface DiffLine {
  key: string;
  before: string;
  after: string;
}

function show(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

/** The fields that changed between the snapshots (all fields for a create or delete). */
export function diffLines(diff: AuditRow['diff']): DiffLine[] {
  if (!diff) return [];
  const before = (diff.before ?? {}) as Record<string, unknown>;
  const after = (diff.after ?? {}) as Record<string, unknown>;
  if (typeof before !== 'object' || typeof after !== 'object') {
    return [{ key: '', before: show(diff.before), after: show(diff.after) }];
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .filter((k) => !['updatedAt', 'createdAt'].includes(k))
    .map((k) => ({ key: k, before: show(before[k]), after: show(after[k]) }));
}

/**
 * Audit log (admin only, `GET admin/audit`): newest first, filtered by entity type and actor (the
 * API's only filters), each row expanding to the fields that changed.
 */
@Component({
  selector: 'app-admin-audit',
  imports: [TranslocoPipe, LocalDatePipe, Pagination, AdminPageHead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-admin-page-head [heading]="'admin.system.audit.title' | transloco" />
    <div class="mb-4 flex flex-wrap items-end gap-3">
      <label class="flex min-w-56 flex-col gap-2">
        <span class="field-label">{{ 'admin.system.audit.entity' | transloco }}</span>
        <select class="control" (change)="setFilter('entity', $any($event.target).value)">
          <option value="" [selected]="!entity()">{{ 'admin.content.all' | transloco }}</option>
          @for (e of entities; track e) {
            <option [value]="e" [selected]="e === entity()" dir="ltr">{{ e }}</option>
          }
        </select>
      </label>
      <label class="flex min-w-56 flex-col gap-2">
        <span class="field-label">{{ 'admin.system.audit.actor' | transloco }}</span>
        <select class="control" (change)="setFilter('actor', $any($event.target).value)">
          <option value="" [selected]="!actor()">{{ 'admin.content.all' | transloco }}</option>
          @for (u of users.value() ?? []; track u.id) {
            <option [value]="u.id" [selected]="u.id === actor()">{{ u.name }}</option>
          }
        </select>
      </label>
    </div>
    @if (rows.value(); as res) {
      @if (res.data.length) {
        <ol class="m-0 flex list-none flex-col gap-2 p-0" data-testid="audit-rows">
          @for (row of res.data; track row.id) {
            <li class="card p-0">
              <details class="group">
                <summary
                  class="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span
                    class="pill"
                    [class.pill-warn]="row.action === 'delete' || row.action === 'login_failed'"
                    [class.pill-ok]="row.action === 'create' || row.action === 'publish'"
                    >{{ 'admin.system.audit.actions.' + row.action | transloco }}</span
                  >
                  <code class="t-small" dir="ltr"
                    >{{ row.entityType }}{{ row.entityId ? ' #' + row.entityId : '' }}</code
                  >
                  <span class="min-w-0 flex-1 truncate" dir="auto">{{ row.entityLabel }}</span>
                  <span class="t-small text-text-muted"
                    >{{ actorName(row.actorId) }} ·
                    {{ row.createdAt | localDate: 'datetime' }}</span
                  >
                </summary>
                <div class="border-t border-border px-4 py-3">
                  @if (lines(row).length) {
                    <table class="w-full border-collapse text-start text-sm">
                      <thead>
                        <tr class="text-text-muted">
                          <th scope="col" class="py-1 pe-3 text-start font-semibold">
                            {{ 'admin.system.audit.field' | transloco }}
                          </th>
                          <th scope="col" class="py-1 pe-3 text-start font-semibold">
                            {{ 'admin.system.audit.before' | transloco }}
                          </th>
                          <th scope="col" class="py-1 text-start font-semibold">
                            {{ 'admin.system.audit.after' | transloco }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (l of lines(row); track l.key) {
                          <tr class="border-t border-border align-top">
                            <th scope="row" class="py-1 pe-3 text-start font-medium" dir="ltr">
                              <code>{{ l.key }}</code>
                            </th>
                            <td class="max-w-80 py-1 pe-3 break-all" dir="auto">{{ l.before }}</td>
                            <td class="max-w-80 py-1 break-all" dir="auto">{{ l.after }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  } @else {
                    <p class="t-small m-0 text-text-muted">
                      {{ 'admin.system.audit.noDiff' | transloco }}
                    </p>
                  }
                </div>
              </details>
            </li>
          }
        </ol>
        <app-pagination [page]="page()" [total]="res.total" [pageSize]="pageSize" />
      } @else {
        <p class="card t-muted m-0">{{ 'admin.overview.audit.empty' | transloco }}</p>
      }
    } @else if (rows.error()) {
      <p class="note note-warn" role="alert">{{ 'admin.common.loadError' | transloco }}</p>
    } @else {
      <span class="skeleton block h-60" aria-hidden="true"></span>
    }
  `,
})
export class AdminAudit {
  readonly entity = input<string | null>(null);
  readonly actor = input<string | null>(null);
  readonly page = input(1, { transform: (v: unknown) => numberAttribute(v, 1) });

  private readonly api = inject(SystemApi);
  private readonly router = inject(Router);
  private readonly locale = inject(LocaleService);
  protected readonly entities = AUDIT_ENTITIES;
  protected readonly pageSize = PAGE;
  protected readonly users = rxResource({ stream: () => this.api.users() });
  protected readonly rows = rxResource({
    params: () => ({
      entity: this.entity() || null,
      actor: this.actor() || null,
      page: this.page(),
      limit: PAGE,
    }),
    stream: ({ params }) => this.api.audit(params),
  });
  private readonly names = computed(
    () => new Map((this.users.value() ?? []).map((u) => [u.id, u.name])),
  );

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
  }

  protected actorName(id: string | null): string {
    return id ? (this.names().get(id) ?? `#${id}`) : '—';
  }

  protected lines(row: AuditRow): DiffLine[] {
    return diffLines(row.diff);
  }

  protected setFilter(key: 'entity' | 'actor', value: string): void {
    void this.router.navigate([], {
      queryParams: { [key]: value || null, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
