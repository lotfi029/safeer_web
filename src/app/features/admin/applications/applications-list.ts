import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AdminApi, saveBlob } from '../../../core/api/admin/admin-api';
import type {
  AdminApplicationListItem,
  AdminAssignee,
  BulkActionBody,
  BulkActionResult,
} from '../../../core/api/admin/admin-models';
import { APPLICATION_STATUSES, type ApplicationStatus, type Id } from '../../../core/api/models';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { DigitsPipe, LocalDatePipe, toArabicDigits } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import {
  type DataTableColumn,
  DataTable,
  DataTableActions,
  DataTableCell,
} from '../../../shared/ui/data-table/data-table';
import { DialogService } from '../../../shared/ui/dialog/dialog';
import { FilterBar, type FilterChip } from '../../../shared/ui/filter-bar/filter-bar';
import { Icon } from '../../../shared/ui/icon/icon';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { ToastService } from '../../../shared/ui/toast/toast';
import { AdminBadges } from '../layout/admin-badges';
import { AdminPageHead } from '../layout/admin-page-head';
import {
  AssignDialog,
  RequestDocsDialog,
  type RequestDocsResult,
  StatusDialog,
} from './application-dialogs';
import { SETTABLE_STATUSES } from './transitions';

export const PAGE_SIZE = 20;

/** The list query from the URL (`?status=&q=&reviewer=&page=`); unknown statuses are ignored. */
export function listQuery(params: {
  status?: string | null;
  q?: string | null;
  reviewer?: string | null;
  page?: number | null;
}) {
  const status = APPLICATION_STATUSES.includes(params.status as ApplicationStatus)
    ? (params.status as ApplicationStatus)
    : null;
  return {
    status,
    q: params.q?.trim() || null,
    reviewerId: params.reviewer?.trim() || null,
    page: params.page && params.page > 1 ? Math.floor(params.page) : 1,
    limit: PAGE_SIZE,
  };
}

export function fullName(
  a: Pick<AdminApplicationListItem, 'firstName' | 'middleName' | 'lastName'>,
) {
  return [a.firstName, a.middleName, a.lastName].filter(Boolean).join(' ');
}

/**
 * Applications (prototype `aApps`): status tabs with counts, search and reviewer filter (all in the
 * URL), a selectable table that becomes cards below md with a selection mode, bulk assign / status /
 * request-documents with per-row results (partial success is normal), and CSV export.
 */
@Component({
  selector: 'app-applications-list',
  imports: [
    RouterLink,
    TranslocoPipe,
    DigitsPipe,
    LocalDatePipe,
    Button,
    DataTable,
    DataTableCell,
    DataTableActions,
    FilterBar,
    Icon,
    Pagination,
    StatusPill,
    AdminPageHead,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-page-head
      [heading]="'admin.applications.title' | transloco"
      [sub]="
        result.hasValue()
          ? ('admin.applications.total' | transloco: { count: (result.value().total | digits) })
          : null
      "
    >
      <button
        pageActions
        appButton
        variant="line"
        size="sm"
        type="button"
        [busy]="exporting()"
        [disabled]="exporting()"
        (click)="exportCsv()"
      >
        <app-icon name="download" [size]="18" />
        {{ 'admin.applications.export' | transloco }}
      </button>
    </app-admin-page-head>

    <div class="flex flex-col gap-5">
      <app-filter-bar
        [chips]="chips()"
        [selected]="query().status"
        [linkMode]="true"
        queryParamName="status"
        [label]="'admin.applications.tabs' | transloco"
        [searchValue]="query().q ?? ''"
        [placeholder]="'admin.applications.search' | transloco"
        [searchLabel]="'admin.applications.search' | transloco"
        (searchChange)="setParams({ q: $event || null })"
      />

      <div class="flex flex-wrap items-end gap-3">
        <label class="flex min-w-56 flex-col gap-2">
          <span class="field-label">{{ 'admin.applications.reviewer' | transloco }}</span>
          <select
            class="control"
            [value]="query().reviewerId ?? ''"
            (change)="setParams({ reviewer: $any($event.target).value || null })"
          >
            <option value="">{{ 'admin.applications.anyReviewer' | transloco }}</option>
            @for (a of assignees.value() ?? []; track a.id) {
              <option [value]="a.id">{{ a.name }}</option>
            }
          </select>
        </label>
      </div>

      @if (selection().length) {
        <div
          class="card flex flex-wrap items-center gap-3 border-secondary bg-secondary-light py-4"
          role="region"
          [attr.aria-label]="'admin.applications.bulk.label' | transloco"
          data-testid="bulk-bar"
        >
          <strong class="me-auto text-heading">{{
            'ui.table.selected' | transloco: { count: (selection().length | digits) }
          }}</strong>
          <button
            appButton
            variant="line"
            size="sm"
            type="button"
            [disabled]="bulkBusy()"
            (click)="bulkAssign()"
          >
            {{ 'admin.applications.bulk.assign' | transloco }}
          </button>
          <button
            appButton
            variant="line"
            size="sm"
            type="button"
            [disabled]="bulkBusy()"
            (click)="bulkRequest()"
          >
            {{ 'admin.applications.bulk.requestDocs' | transloco }}
          </button>
          <button appButton size="sm" type="button" [disabled]="bulkBusy()" (click)="bulkStatus()">
            {{ 'admin.applications.bulk.status' | transloco }}
          </button>
        </div>
      }

      @if (bulkFailures().length) {
        <div class="note note-warn" role="alert" data-testid="bulk-failures">
          <app-icon name="circle-alert" />
          <div class="flex flex-col gap-1">
            <p class="m-0 font-semibold">{{ bulkSummary() }}</p>
            <ul class="m-0 ps-5">
              @for (f of bulkFailures(); track f.id) {
                <li>
                  {{
                    'admin.applications.bulk.failedRow'
                      | transloco: { reference: f.reference, error: f.error }
                  }}
                </li>
              }
            </ul>
          </div>
        </div>
      }

      <app-data-table
        [columns]="columns()"
        [rows]="result.value()?.data ?? []"
        [trackBy]="trackById"
        [caption]="'admin.applications.caption' | transloco"
        [loading]="result.isLoading() && !result.hasValue()"
        [error]="result.error() ? ('admin.common.loadError' | transloco) : null"
        [selectable]="true"
        [(selection)]="selection"
      >
        <ng-template appDataTableCell="reference" let-row>
          <a
            class="font-bold text-heading"
            dir="ltr"
            [routerLink]="locale.link('/admin/applications/' + row.id)"
            >{{ row.reference }}</a
          >
        </ng-template>
        <ng-template appDataTableCell="status" let-row>
          <span class="inline-flex flex-wrap items-center gap-2">
            <app-status-pill [status]="row.status" />
            @if (row.hasUnreviewedResubmission) {
              <span
                class="pill pill-warn"
                [attr.title]="'admin.applications.resubmitted' | transloco"
              >
                <app-icon name="file-up" [size]="14" />
                <span class="sr-only">{{ 'admin.applications.resubmitted' | transloco }}</span>
              </span>
            }
          </span>
        </ng-template>
        <ng-template appDataTableCell="submitted" let-row>
          {{ row.submittedAt | localDate: 'medium' }}
        </ng-template>
        <ng-template appDataTableActions let-row>
          <a
            appButton
            variant="link"
            size="sm"
            [routerLink]="locale.link('/admin/applications/' + row.id)"
            >{{ 'admin.common.open' | transloco
            }}<span class="sr-only"> {{ row.reference }}</span></a
          >
        </ng-template>
      </app-data-table>

      @if (result.value(); as p) {
        <app-pagination [page]="query().page" [total]="p.total" [pageSize]="pageSize" />
      }
    </div>
  `,
})
export class ApplicationsList {
  readonly status = input<string | null>(null);
  readonly q = input<string | null>(null);
  readonly reviewer = input<string | null>(null);
  /** Query param `?page=`. */
  readonly page = input(1, { transform: (v: unknown) => numberAttribute(v, 1) });

  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly badges = inject(AdminBadges);
  private readonly doc = inject(DOCUMENT);
  protected readonly locale = inject(LocaleService);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly trackById = (row: AdminApplicationListItem) => row.id;

  protected readonly query = computed(() =>
    listQuery({
      status: this.status(),
      q: this.q(),
      reviewer: this.reviewer(),
      page: this.page(),
    }),
  );
  private readonly reload = signal(0);

  protected readonly result = rxResource({
    params: () => ({ query: this.query(), reload: this.reload() }),
    stream: ({ params }) => this.api.applications(params.query),
  });
  protected readonly counts = rxResource({
    params: () => this.reload(),
    stream: () => this.api.applicationCounts(),
  });
  protected readonly assignees = rxResource({ stream: () => this.api.assignees() });

  /** Selected application ids (the table's selection model). */
  protected readonly selection = signal<readonly Id[]>([]);
  protected readonly bulkBusy = signal(false);
  protected readonly exporting = signal(false);
  protected readonly bulkFailures = signal<(BulkActionResult & { reference: string })[]>([]);
  protected readonly bulkSummary = signal('');

  protected readonly chips = computed<FilterChip[]>(() => {
    const counts = this.counts.value();
    const label = (key: string, n: number | undefined) =>
      n === undefined ? key : `${key} ${this.digits(n)}`;
    return [
      { value: null, label: label(this.t.translate('admin.applications.all'), counts?.all) },
      ...(
        [
          'new',
          'under_review',
          'docs_missing',
          'interview',
          'accepted',
          'rejected',
          'draft',
        ] as const
      ).map((s) => ({ value: s, label: label(this.t.translate(`status.${s}`), counts?.[s]) })),
    ];
  });

  protected readonly columns = computed<DataTableColumn<AdminApplicationListItem>[]>(() => {
    this.locale.lang();
    const h = (k: string) => this.t.translate(`admin.applications.columns.${k}`);
    return [
      { key: 'reference', header: h('reference'), value: (r) => r.reference },
      { key: 'name', header: h('name'), value: (r) => fullName(r) || '—' },
      {
        key: 'nationality',
        header: h('nationality'),
        value: (r) => r.nationality ?? '—',
        hideOnMobile: true,
      },
      { key: 'university', header: h('university'), value: (r) => r.university ?? '—' },
      {
        key: 'degree',
        header: h('degree'),
        value: (r) =>
          r.degreeLevel ? this.t.translate(`admin.applications.degree.${r.degreeLevel}`) : '—',
        hideOnMobile: true,
      },
      { key: 'status', header: h('status') },
      {
        key: 'reviewer',
        header: h('reviewer'),
        value: (r) => r.assignedReviewer?.name ?? this.t.translate('admin.common.unassigned'),
      },
      { key: 'submitted', header: h('submitted'), hideOnMobile: true },
    ];
  });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
    // A new page of results starts with nothing selected.
    effect(() => {
      this.query();
      this.selection.set([]);
    });
  }

  private digits(n: number): string {
    return this.locale.lang() === 'ar' ? toArabicDigits(String(n)) : String(n);
  }

  protected setParams(params: Record<string, string | null>): void {
    void this.router.navigate([], {
      queryParams: { ...params, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected async exportCsv(): Promise<void> {
    this.exporting.set(true);
    try {
      const { status, q, reviewerId } = this.query();
      const file = await firstValueFrom(this.api.exportApplications({ status, q, reviewerId }));
      saveBlob(this.doc, file.blob, file.filename);
      this.toasts.show({
        kind: file.truncated ? 'info' : 'success',
        message: file.truncated
          ? this.t.translate('admin.applications.exportTruncated', { count: this.digits(5000) })
          : this.t.translate('admin.applications.exported'),
        duration: file.truncated ? 0 : 5000,
      });
    } catch (error) {
      this.toasts.show({
        kind: 'error',
        message: this.t.translate(problemMessageKey(toApiProblem(error))),
      });
    } finally {
      this.exporting.set(false);
    }
  }

  protected async bulkAssign(): Promise<void> {
    const assignees: AdminAssignee[] = this.assignees.value() ?? [];
    const ref = this.dialogs.open<string | null>(AssignDialog, {
      data: { assignees, allowClear: true },
      ariaLabelledBy: 'assign-title',
    });
    const reviewerId = await firstValueFrom(ref.closed);
    if (reviewerId === undefined) return;
    await this.runBulk({ action: 'assign', reviewerId });
  }

  protected async bulkStatus(): Promise<void> {
    const ref = this.dialogs.open<ApplicationStatus>(StatusDialog, {
      data: { statuses: SETTABLE_STATUSES },
      ariaLabelledBy: 'status-title',
    });
    const status = await firstValueFrom(ref.closed);
    if (!status) return;
    await this.runBulk({ action: 'status', status });
  }

  protected async bulkRequest(): Promise<void> {
    const ref = this.dialogs.open<RequestDocsResult>(RequestDocsDialog, {
      ariaLabelledBy: 'request-title',
    });
    const result = await firstValueFrom(ref.closed);
    if (!result) return;
    await this.runBulk({ action: 'request_documents', ...result });
  }

  private async runBulk(body: Omit<BulkActionBody, 'ids'>): Promise<void> {
    const ids = [...this.selection()];
    const refs = new Map<Id, string>(
      (this.result.value()?.data ?? []).map((r) => [r.id, r.reference]),
    );
    this.bulkBusy.set(true);
    this.bulkFailures.set([]);
    try {
      const results = await firstValueFrom(this.api.bulk({ ...body, ids }));
      const failed = results.filter((r) => !r.ok);
      const ok = results.length - failed.length;
      if (failed.length) {
        this.bulkSummary.set(
          this.t.translate('admin.applications.bulk.result', {
            ok: this.digits(ok),
            failed: this.digits(failed.length),
          }),
        );
        this.bulkFailures.set(
          failed.map((f) => ({ ...f, reference: refs.get(f.id) ?? f.id, error: f.error ?? '' })),
        );
      } else {
        this.toasts.show({
          kind: 'success',
          message: this.t.translate('admin.applications.bulk.allOk', { count: this.digits(ok) }),
        });
      }
      this.selection.set([]);
      this.reload.update((n) => n + 1);
      void this.badges.refresh();
    } catch (error) {
      this.toasts.show({
        kind: 'error',
        message: this.t.translate(problemMessageKey(toApiProblem(error))),
      });
    } finally {
      this.bulkBusy.set(false);
    }
  }
}
