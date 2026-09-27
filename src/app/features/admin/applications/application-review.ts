import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AdminApi, documentUrl } from '../../../core/api/admin/admin-api';
import { SystemApi } from '../../../core/api/admin/system-api';
import { StaffSessionStore } from '../../../core/auth/staff-session.store';
import type {
  AdminApplicationDetail,
  AdminApplicationEvent,
} from '../../../core/api/admin/admin-models';
import type {
  AdminApplicationDocument,
  ApplicationStatus,
  DocType,
} from '../../../core/api/models';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { FileSizePipe, LocalDatePipe, RelTimePipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { DialogService } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { DocStatusPill, StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { ToastService } from '../../../shared/ui/toast/toast';
import { AdminBadges } from '../layout/admin-badges';
import { AdminPageHead } from '../layout/admin-page-head';
import { confirmAction } from '../shared/confirm-dialog';
import {
  RejectDocumentDialog,
  RequestDocsDialog,
  type RequestDocsResult,
} from './application-dialogs';
import { canRequestDocuments, canReviewDocuments, nextStatuses } from './transitions';

/** Decision buttons for a status: accept/reject get their own wording, other moves say "Move to". */
export function decisionActions(status: ApplicationStatus) {
  return nextStatuses(status).map((to) => ({
    to,
    variant: to === 'accepted' ? 'primary' : to === 'rejected' ? 'danger' : 'line',
    labelKey:
      to === 'accepted'
        ? 'admin.review.actions.accept'
        : to === 'rejected'
          ? 'admin.review.actions.reject'
          : 'admin.review.status.moveTo',
  })) as { to: ApplicationStatus; variant: 'primary' | 'danger' | 'line'; labelKey: string }[];
}

/** The activity-log line for an event (types from the API's application_events). */
export function eventLine(
  e: Pick<AdminApplicationEvent, 'type' | 'data'>,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const data = e.data ?? {};
  const docType = (v: unknown) => (typeof v === 'string' ? t(`docType.${v}`) : '');
  const docTypes = (v: unknown) =>
    Array.isArray(v) ? v.map(docType).filter(Boolean).join('، ') : '';
  switch (e.type) {
    case 'STATUS_CHANGED':
      return t('admin.review.log.events.STATUS_CHANGED', {
        to: typeof data['to'] === 'string' ? t(`status.${data['to']}`) : '',
      });
    case 'DOCS_REQUESTED':
    case 'DOCS_RESUBMITTED':
      return t(`admin.review.log.events.${e.type}`, { types: docTypes(data['docTypes']) });
    case 'DOCUMENT_ACCEPTED':
    case 'DOCUMENT_REJECTED':
      return t(`admin.review.log.events.${e.type}`, { type: docType(data['docType']) });
    case 'STARTED':
    case 'SUBMITTED':
    case 'REVIEWER_ASSIGNED':
    case 'DOCS_RECEIVED':
    case 'APPLICANT_CORRECTED':
    case 'INTERVIEW_BOOKED':
    case 'INTERVIEW_CANCELLED':
      return t(`admin.review.log.events.${e.type}`);
    default:
      return t('admin.review.log.events.other', { type: e.type });
  }
}

/**
 * Application review (prototype `aReview`): personal and academic details, documents with
 * accept/reject (a reason is required to reject; the viewer only when `downloadPath` is set), the
 * assigned reviewer, the status transitions the shared map allows, internal notes and the full
 * activity log. Below lg the decisions sit in a sticky footer.
 */
@Component({
  selector: 'app-application-review',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
    FileSizePipe,
    LocalDatePipe,
    RelTimePipe,
    Button,
    Icon,
    DocStatusPill,
    StatusPill,
    AdminPageHead,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <a
      class="mb-3 inline-flex items-center gap-1 font-semibold text-secondary-text"
      [routerLink]="locale.link('/admin/applications')"
    >
      <app-icon name="arrow-left" [size]="18" />{{ 'admin.review.back' | transloco }}
    </a>

    @if (detail.error() && !detail.hasValue()) {
      <div class="note note-warn" role="alert">
        <app-icon name="circle-alert" />
        <p class="m-0">{{ loadErrorKey() | transloco }}</p>
        <button appButton variant="line" size="sm" type="button" (click)="detail.reload()">
          {{ 'common.retry' | transloco }}
        </button>
      </div>
    } @else if (detail.value(); as a) {
      <app-admin-page-head
        [heading]="name() || ('common.missingValue' | transloco)"
        [sub]="subline()"
      >
        <span pageBefore class="flex items-center gap-2">
          <app-status-pill [status]="a.status" data-testid="review-status" />
        </span>
        <div pageActions class="hidden flex-wrap gap-2 lg:flex">
          <ng-container *ngTemplateOutlet="decisions" />
        </div>
      </app-admin-page-head>

      @if (statusNote(); as note) {
        <p class="note mb-6">{{ note | transloco }}</p>
      }

      <div class="grid gap-6 pb-28 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-0">
        <div class="flex min-w-0 flex-col gap-6">
          <section class="card flex flex-col gap-5" aria-labelledby="personal-title">
            <h2 class="t-h4 m-0 text-heading" id="personal-title">
              {{ 'admin.review.personal.title' | transloco }}
            </h2>
            <dl class="m-0 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
              @for (f of personalFields(); track f.key) {
                <div class="flex min-w-0 flex-col gap-1">
                  <dt class="t-small text-text-muted">
                    {{ 'admin.review.personal.' + f.key | transloco }}
                  </dt>
                  <dd
                    class="m-0 font-semibold break-words text-heading"
                    [attr.dir]="f.ltr ? 'ltr' : null"
                    [class.text-start]="f.ltr"
                  >
                    {{ f.value || ('common.missingValue' | transloco) }}
                  </dd>
                </div>
              }
            </dl>
          </section>

          <section class="card flex flex-col gap-5" aria-labelledby="study-title">
            <h2 class="t-h4 m-0 text-heading" id="study-title">
              {{ 'admin.review.study.title' | transloco }}
            </h2>
            <dl class="m-0 grid gap-x-6 gap-y-5 sm:grid-cols-3">
              <div class="flex flex-col gap-1">
                <dt class="t-small text-text-muted">
                  {{ 'admin.review.study.university' | transloco }}
                </dt>
                <dd class="m-0 font-semibold text-heading">
                  {{ a.study.university || ('common.missingValue' | transloco) }}
                </dd>
              </div>
              <div class="flex flex-col gap-1">
                <dt class="t-small text-text-muted">
                  {{ 'admin.review.study.degree' | transloco }}
                </dt>
                <dd class="m-0 font-semibold text-heading">
                  {{
                    a.study.degreeLevel
                      ? ('admin.applications.degree.' + a.study.degreeLevel | transloco)
                      : ('common.missingValue' | transloco)
                  }}
                </dd>
              </div>
              <div class="flex flex-col gap-1">
                <dt class="t-small text-text-muted">
                  {{ 'admin.review.study.major' | transloco }}
                </dt>
                <dd class="m-0 font-semibold text-heading">
                  {{ a.study.major || ('common.missingValue' | transloco) }}
                </dd>
              </div>
            </dl>
            @if (a.study.scholarshipNote) {
              <div class="flex flex-col gap-2 border-t border-border pt-4">
                <p class="t-small m-0 text-text-muted">
                  {{ 'admin.review.study.note' | transloco }}
                </p>
                <p class="m-0 whitespace-pre-line">{{ a.study.scholarshipNote }}</p>
              </div>
            }
          </section>

          <section class="card flex flex-col gap-5" aria-labelledby="docs-title">
            <h2 class="t-h4 m-0 text-heading" id="docs-title">
              {{ 'admin.review.documents.title' | transloco }}
            </h2>
            @if (!reviewable()) {
              <p class="t-small m-0 text-text-muted">
                {{ 'admin.review.documents.closed' | transloco }}
              </p>
            }
            @if (a.documents.length) {
              <ul
                class="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3"
                data-testid="review-documents"
              >
                @for (d of a.documents; track d.id) {
                  <li
                    class="flex flex-col gap-3 rounded-card border border-border p-4"
                    [attr.data-doc-type]="d.docType"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <strong class="text-heading">{{ 'docType.' + d.docType | transloco }}</strong>
                      <app-doc-status-pill [status]="d.status" />
                    </div>
                    <p class="t-small m-0 break-all text-text-muted" dir="ltr">
                      {{ d.originalName }} · {{ d.sizeBytes | fileSize }}
                    </p>
                    @if (d.status === 'rejected' && d.rejectionReason) {
                      <p class="t-small m-0 text-alert-text">
                        {{
                          'admin.review.documents.reason' | transloco: { reason: d.rejectionReason }
                        }}
                      </p>
                    }
                    <div class="mt-auto flex flex-wrap items-center gap-2">
                      @if (fileUrl(d); as url) {
                        <a
                          appButton
                          variant="link"
                          size="sm"
                          [href]="url"
                          target="_blank"
                          rel="noopener"
                          data-testid="doc-view"
                        >
                          <app-icon name="eye" [size]="16" />{{
                            'admin.review.documents.view' | transloco
                          }}
                          <span class="sr-only">{{ 'docType.' + d.docType | transloco }}</span>
                        </a>
                      } @else {
                        <span class="t-small text-text-muted">{{
                          'admin.review.documents.noFile' | transloco
                        }}</span>
                      }
                      @if (reviewable()) {
                        <span class="grow"></span>
                        @if (d.status !== 'accepted') {
                          <button
                            appButton
                            variant="soft"
                            size="sm"
                            type="button"
                            [disabled]="busy()"
                            (click)="reviewDoc(d, 'accepted')"
                          >
                            {{ 'admin.review.documents.accept' | transloco }}
                            <span class="sr-only">{{ 'docType.' + d.docType | transloco }}</span>
                          </button>
                        }
                        @if (d.status !== 'rejected') {
                          <button
                            appButton
                            variant="line"
                            size="sm"
                            type="button"
                            [disabled]="busy()"
                            (click)="reviewDoc(d, 'rejected')"
                          >
                            {{ 'admin.review.documents.reject' | transloco }}
                            <span class="sr-only">{{ 'docType.' + d.docType | transloco }}</span>
                          </button>
                        }
                      }
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <p class="t-muted m-0">{{ 'admin.review.documents.none' | transloco }}</p>
            }
          </section>
        </div>

        <aside class="flex min-w-0 flex-col gap-6">
          <section class="card flex flex-col gap-4" aria-labelledby="assign-title-side">
            <h2 class="t-h4 m-0 text-heading" id="assign-title-side">
              {{ 'admin.review.assignment.title' | transloco }}
            </h2>
            <div class="flex flex-wrap gap-2">
              <label class="sr-only" for="review-assignee">{{
                'admin.review.assignment.title' | transloco
              }}</label>
              <select
                id="review-assignee"
                class="control min-w-0 flex-1"
                [value]="assignee()"
                (change)="assignee.set($any($event.target).value)"
              >
                <option value="">{{ 'admin.common.unassigned' | transloco }}</option>
                @for (p of assignees.value() ?? []; track p.id) {
                  <option [value]="p.id">{{ p.name }}</option>
                }
              </select>
              <button
                appButton
                variant="line"
                type="button"
                [disabled]="busy() || assignee() === (a.assignedReviewer?.id ?? '')"
                (click)="saveAssignee()"
              >
                {{ 'admin.review.assignment.save' | transloco }}
              </button>
            </div>
          </section>

          <section class="card flex flex-col gap-4" aria-labelledby="notes-title">
            <h2 class="t-h4 m-0 text-heading" id="notes-title">
              {{ 'admin.review.notes.title' | transloco }}
            </h2>
            <label class="sr-only" for="review-note">{{
              'admin.review.notes.label' | transloco
            }}</label>
            <textarea
              id="review-note"
              class="control"
              rows="4"
              maxlength="5000"
              [placeholder]="'admin.review.notes.placeholder' | transloco"
              [value]="note()"
              (input)="note.set($any($event.target).value)"
            ></textarea>
            <button
              appButton
              variant="soft"
              type="button"
              [disabled]="busy() || !note().trim()"
              (click)="addNote()"
            >
              {{ 'admin.review.notes.add' | transloco }}
            </button>
            @if (a.notes.length) {
              <ul
                class="m-0 flex list-none flex-col gap-4 border-t border-border p-0 pt-4"
                data-testid="review-notes"
              >
                @for (n of a.notes; track n.id) {
                  <li class="flex flex-col gap-1">
                    <p class="m-0 whitespace-pre-line">{{ n.body }}</p>
                    <p class="t-caption m-0 text-text-muted">
                      {{ n.authorName || ('admin.common.system' | transloco) }} ·
                      {{ n.createdAt | localDate: 'datetime' }}
                    </p>
                  </li>
                }
              </ul>
            } @else {
              <p class="t-small m-0 text-text-muted">
                {{ 'admin.review.notes.empty' | transloco }}
              </p>
            }
          </section>

          <section class="card flex flex-col gap-4" aria-labelledby="log-title">
            <h2 class="t-h4 m-0 text-heading" id="log-title">
              {{ 'admin.review.log.title' | transloco }}
            </h2>
            @if (a.events.length) {
              <ol class="m-0 flex list-none flex-col gap-3 p-0" data-testid="review-log">
                @for (e of a.events; track e.id; let first = $first) {
                  <li class="flex gap-3">
                    <span
                      class="mt-2 block size-2.5 shrink-0 rounded-full"
                      [class]="first ? 'bg-secondary' : 'bg-border'"
                      aria-hidden="true"
                    ></span>
                    <div class="flex min-w-0 flex-col">
                      <span>{{ line(e) }}</span>
                      <span class="t-caption text-text-muted">
                        {{ e.actorName || ('admin.common.system' | transloco) }} ·
                        {{ e.createdAt | relTime }}
                        @if (!e.visibleToApplicant) {
                          · {{ 'admin.review.log.hidden' | transloco }}
                        }
                      </span>
                    </div>
                  </li>
                }
              </ol>
            } @else {
              <p class="t-small m-0 text-text-muted">{{ 'admin.review.log.empty' | transloco }}</p>
            }
          </section>

          @if (canAnonymise()) {
            <section class="card flex flex-col gap-3 border-alert" aria-labelledby="anon-title">
              <h2 class="t-h4 m-0 text-alert-text" id="anon-title">
                {{ 'admin.review.anonymise.title' | transloco }}
              </h2>
              <p class="t-small m-0">{{ 'admin.review.anonymise.lead' | transloco }}</p>
              <button
                appButton
                variant="danger"
                size="sm"
                type="button"
                class="self-start"
                [disabled]="busy()"
                (click)="anonymise()"
              >
                {{ 'admin.review.anonymise.button' | transloco }}
              </button>
            </section>
          }
        </aside>
      </div>

      @if (actions().length || requestable()) {
        <div
          class="fixed inset-x-0 bottom-0 z-20 flex flex-wrap justify-end gap-2 border-t border-border bg-card px-4 py-3 shadow-[var(--shadow-md)] lg:hidden"
          data-testid="decision-footer"
        >
          <ng-container *ngTemplateOutlet="decisions" />
        </div>
      }

      <ng-template #decisions>
        @if (requestable()) {
          <button
            appButton
            variant="line"
            size="sm"
            type="button"
            [disabled]="busy()"
            (click)="requestDocs()"
          >
            {{ 'admin.review.actions.requestDocs' | transloco }}
          </button>
        }
        @for (act of actions(); track act.to) {
          <button
            appButton
            size="sm"
            [variant]="act.variant"
            type="button"
            [disabled]="busy()"
            [attr.data-to]="act.to"
            (click)="changeStatus(act.to)"
          >
            {{ act.labelKey | transloco: { status: ('status.' + act.to | transloco) } }}
          </button>
        }
      </ng-template>
    } @else {
      <div class="card flex flex-col gap-3" aria-hidden="true">
        <span class="skeleton h-7 w-1/3"></span>
        <span class="skeleton h-5 w-2/3"></span>
        <span class="skeleton h-5 w-1/2"></span>
      </div>
      <p class="sr-only" role="status">{{ 'common.loading' | transloco }}</p>
    }
  `,
})
export class ApplicationReview {
  /** Route param. */
  readonly id = input.required<string>();

  private readonly api = inject(AdminApi);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly badges = inject(AdminBadges);
  private readonly store = inject(StaffSessionStore);
  private readonly system = inject(SystemApi);
  protected readonly locale = inject(LocaleService);

  protected readonly detail = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.application(params),
  });
  protected readonly assignees = rxResource({ stream: () => this.api.assignees() });

  protected readonly busy = signal(false);
  protected readonly note = signal('');
  /** The reviewer picked in the select; follows the saved value whenever the detail reloads. */
  protected readonly assignee = linkedSignal(() => this.detail.value()?.assignedReviewer?.id ?? '');

  protected readonly name = computed(() => {
    const p = this.detail.value()?.personal;
    return [p?.firstName, p?.middleName, p?.lastName].filter(Boolean).join(' ');
  });
  protected readonly subline = computed(() => {
    const a = this.detail.value();
    if (!a) return null;
    const when = a.submittedAt
      ? this.t.translate('admin.review.submittedOn', {
          date: new Intl.DateTimeFormat(this.locale.intlLocale(), {
            dateStyle: 'medium',
            timeZone: 'Asia/Riyadh',
          }).format(new Date(a.submittedAt)),
        })
      : this.t.translate('admin.review.notSubmitted');
    return `${a.reference} · ${when}`;
  });
  protected readonly personalFields = computed(() => {
    const a = this.detail.value();
    if (!a) return [];
    const p = a.personal;
    return [
      { key: 'fullName', value: this.name(), ltr: false },
      { key: 'birthDate', value: p.birthDate, ltr: false },
      {
        key: 'gender',
        value: p.gender ? this.t.translate(`admin.review.gender.${p.gender}`) : null,
        ltr: false,
      },
      { key: 'nationality', value: p.nationality, ltr: false },
      { key: 'idNumber', value: p.idNumber, ltr: true },
      { key: 'currentJob', value: p.currentJob, ltr: false },
      { key: 'phone', value: p.phone, ltr: true },
      { key: 'email', value: p.email, ltr: true },
    ];
  });
  protected readonly actions = computed(() => {
    const a = this.detail.value();
    return a ? decisionActions(a.status) : [];
  });
  protected readonly requestable = computed(() => {
    const a = this.detail.value();
    return !!a && canRequestDocuments(a.status);
  });
  protected readonly reviewable = computed(() => {
    const a = this.detail.value();
    return !!a && canReviewDocuments(a.status);
  });
  protected readonly statusNote = computed(() => {
    const s = this.detail.value()?.status;
    if (s === 'draft') return 'admin.review.status.draft';
    if (s === 'accepted' || s === 'rejected') return 'admin.review.status.terminal';
    return null;
  });
  protected readonly canAnonymise = computed(() => this.store.can('applications.delete'));
  protected readonly loadErrorKey = computed(() => {
    const err = this.detail.error();
    return err ? problemMessageKey(toApiProblem(err)) : 'admin.common.loadError';
  });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
  }

  protected fileUrl(doc: AdminApplicationDocument): string | null {
    return documentUrl(doc);
  }

  protected line(e: AdminApplicationEvent): string {
    return eventLine(e, (key, params) => this.t.translate(key, params));
  }

  private toastError(error: unknown): void {
    this.toasts.show({
      kind: 'error',
      message: this.t.translate(problemMessageKey(toApiProblem(error))),
    });
  }

  private apply(next: AdminApplicationDetail): void {
    this.detail.set(next);
  }

  protected async reviewDoc(
    doc: AdminApplicationDocument,
    status: 'accepted' | 'rejected',
  ): Promise<void> {
    let reason: string | undefined;
    if (status === 'rejected') {
      const ref = this.dialogs.open<string>(RejectDocumentDialog, {
        data: { typeLabel: this.t.translate(`docType.${doc.docType}`) },
        ariaLabelledBy: 'reject-title',
      });
      reason = await firstValueFrom(ref.closed);
      if (!reason) return;
    }
    this.busy.set(true);
    try {
      const updated = await firstValueFrom(
        this.api.reviewDocument(this.id(), doc.id, { status, ...(reason ? { reason } : {}) }),
      );
      const current = this.detail.value();
      if (current) {
        this.detail.set({
          ...current,
          documents: current.documents.map((d) => (d.id === updated.id ? updated : d)),
        });
      }
      this.toasts.show({
        kind: 'success',
        message: this.t.translate(`admin.review.documents.${status}`),
      });
      this.detail.reload();
    } catch (error) {
      this.toastError(error);
      this.detail.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected async changeStatus(to: ApplicationStatus): Promise<void> {
    const label = this.t.translate(`status.${to}`);
    const ok = await confirmAction(this.dialogs, {
      heading: this.t.translate('admin.review.status.title'),
      body: this.t.translate('admin.review.status.confirm', { status: label }),
      confirm: this.t.translate('common.confirm'),
      danger: to === 'rejected',
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      this.apply(await firstValueFrom(this.api.updateApplication(this.id(), { status: to })));
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.review.status.changed', { status: label }),
      });
      void this.badges.refresh();
    } catch (error) {
      if (
        toApiProblem(error).code === 'INVALID_STATUS_TRANSITION' ||
        toApiProblem(error).status === 409
      ) {
        this.toasts.show({
          kind: 'error',
          message: this.t.translate('admin.review.status.conflict'),
        });
        this.detail.reload();
      } else {
        this.toastError(error);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async requestDocs(): Promise<void> {
    const ref = this.dialogs.open<RequestDocsResult>(RequestDocsDialog, {
      ariaLabelledBy: 'request-title',
    });
    const result = await firstValueFrom(ref.closed);
    if (!result) return;
    this.busy.set(true);
    try {
      this.apply(
        await firstValueFrom(
          this.api.requestDocuments(this.id(), result as { docTypes: DocType[] }),
        ),
      );
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.review.status.changed', {
          status: this.t.translate('status.docs_missing'),
        }),
      });
    } catch (error) {
      if (toApiProblem(error).status === 409) this.detail.reload();
      this.toastError(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async saveAssignee(): Promise<void> {
    this.busy.set(true);
    try {
      this.apply(
        await firstValueFrom(
          this.api.updateApplication(this.id(), { assignedReviewerId: this.assignee() || null }),
        ),
      );
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.review.assignment.saved'),
      });
    } catch (error) {
      this.toastError(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async addNote(): Promise<void> {
    const body = this.note().trim();
    if (!body) return;
    this.busy.set(true);
    try {
      const note = await firstValueFrom(this.api.addNote(this.id(), body));
      const current = this.detail.value();
      if (current) this.detail.set({ ...current, notes: [note, ...current.notes] });
      this.note.set('');
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.review.notes.added') });
    } catch (error) {
      this.toastError(error);
    } finally {
      this.busy.set(false);
    }
  }

  /** DELETE admin/applications/:id: removes the personal data and files, keeps reference and dates. */
  protected async anonymise(): Promise<void> {
    const a = this.detail.value();
    if (!a) return;
    const ok = await confirmAction(this.dialogs, {
      heading: this.t.translate('admin.review.anonymise.title'),
      body: this.t.translate('admin.review.anonymise.confirm', { reference: a.reference }),
      confirm: this.t.translate('admin.review.anonymise.button'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.system.anonymise(this.id()));
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.review.anonymise.done', { reference: a.reference }),
      });
      this.detail.reload();
    } catch (error) {
      this.toastError(error);
    } finally {
      this.busy.set(false);
    }
  }
}
