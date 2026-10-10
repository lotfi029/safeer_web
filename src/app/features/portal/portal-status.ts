import type { DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { InterviewSlot, PortalEvent } from '../../core/api/models';
import { PortalApi } from '../../core/api/portal-api';
import { problemMessageKey, toApiProblem } from '../../core/api/problem';
import { ApplicantSessionStore } from '../../core/auth/applicant-session.store';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { formatDate, LocalDatePipe, RelTimePipe } from '../../shared/pipes/format';
import { Button } from '../../shared/ui/button/button';
import { DialogFrame, DialogService } from '../../shared/ui/dialog/dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { StatusPill } from '../../shared/ui/status-pill/status-pill';
import { Timeline, type TimelineItem } from '../../shared/ui/timeline/timeline';
import { ToastService } from '../../shared/ui/toast/toast';

/** Event types the API marks visibleToApplicant (safeer_api @ v1.0.0-rc1); anything else is "other". */
const KNOWN_EVENTS = new Set([
  'STARTED',
  'SUBMITTED',
  'STATUS_CHANGED',
  'DOCS_REQUESTED',
  'DOCS_RECEIVED',
  'DOCUMENT_REJECTED',
  'APPLICANT_CORRECTED',
  'INTERVIEW_BOOKED',
  'INTERVIEW_CANCELLED',
]);

/**
 * Application status (prototype `#/portal-status`): reference + status band, the 5-step timeline
 * from `/portal/me` (`auto` = vertical on mobile, horizontal from md), the action-needed alert
 * linking to documents, interview booking/cancel (C17), summary, latest updates
 * (`/portal/notifications`, C35 shape) and help.
 */
@Component({
  selector: 'app-portal-status',
  imports: [
    RouterLink,
    TranslocoPipe,
    LocalDatePipe,
    RelTimePipe,
    Button,
    DialogFrame,
    Icon,
    StatusPill,
    Timeline,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (me(); as m) {
      <div
        class="wrap grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px]"
      >
        <div class="flex min-w-0 flex-col gap-6">
          <h1 class="sr-only">{{ 'portal.nav.status' | transloco }}</h1>
          <section
            class="card band flex flex-col gap-5 border-0 sm:flex-row sm:items-center sm:justify-between md:!px-10 md:!py-9"
            aria-labelledby="portal-ref"
          >
            <div class="flex flex-col gap-2">
              <span id="portal-ref" class="t-caption !text-band-soft">{{
                'portal.status.reference' | transloco
              }}</span>
              <bdi dir="ltr" class="text-[30px] font-bold" data-testid="reference">{{
                m.reference
              }}</bdi>
              <span class="t-caption !text-band-soft">
                @if (m.submittedAt) {
                  {{ 'portal.status.submitted' | transloco: { date: (m.submittedAt | localDate) } }}
                } @else {
                  {{ 'portal.status.notSubmitted' | transloco }}
                }
                @if (m.decidedAt) {
                  · {{ 'portal.status.decided' | transloco: { date: (m.decidedAt | localDate) } }}
                }
              </span>
            </div>
            <app-status-pill class="self-start sm:self-center" [status]="m.status" />
          </section>

          @if (m.status === 'draft') {
            <div class="note flex-col items-start gap-3 sm:flex-row sm:items-center">
              <span class="grow">{{ 'portal.status.notSubmitted' | transloco }}</span>
              <a appButton size="sm" [routerLink]="locale.link('/apply')">{{
                'portal.status.continueApply' | transloco
              }}</a>
            </div>
          }

          @if (m.actionNeeded; as action) {
            <section
              class="note note-warn flex-col items-start gap-4 sm:flex-row sm:items-center md:!px-8 md:!py-7"
              role="alert"
              aria-labelledby="portal-action"
            >
              <app-icon name="triangle-alert" [size]="26" class="shrink-0" />
              <div class="flex grow flex-col gap-1">
                <strong id="portal-action" class="text-lg">
                  {{ 'portal.status.action' | transloco }}:
                  @if (action.type === 'document_rejected') {
                    {{
                      'portal.status.actionRejected' | transloco: { type: docLabel(action.docType) }
                    }}
                  } @else {
                    {{
                      'portal.status.actionRequested'
                        | transloco: { types: docLabels(action.docTypes) }
                    }}
                  }
                </strong>
                @if (action.reason) {
                  <span>{{ 'portal.status.reasonLabel' | transloco }} {{ action.reason }}</span>
                }
                @if (action.message) {
                  <span>{{ action.message }}</span>
                }
              </div>
              <a
                appButton
                variant="danger"
                size="sm"
                [routerLink]="locale.link('/portal/documents')"
                >{{ 'portal.status.reupload' | transloco }}</a
              >
            </section>
          }

          <section
            class="card flex flex-col gap-6 md:!px-10 md:!py-9"
            aria-labelledby="portal-timeline"
          >
            <h2 id="portal-timeline" class="t-h3 text-[26px]">
              {{ 'portal.status.timeline' | transloco }}
            </h2>
            <app-timeline [items]="timeline()" />
          </section>

          @if (m.status === 'interview' || m.interview) {
            <section
              class="card flex flex-col gap-5"
              aria-labelledby="portal-interview"
              data-testid="interview"
            >
              <h2 id="portal-interview" class="t-h4">{{ 'portal.interview.title' | transloco }}</h2>
              @if (m.interview; as iv) {
                <p class="note note-ok flex-col items-start gap-1">
                  <strong>{{
                    'portal.interview.booked' | transloco: { date: when(iv.startsAt) }
                  }}</strong>
                  @if (iv.location) {
                    <span>{{
                      'portal.interview.location' | transloco: { location: iv.location }
                    }}</span>
                  }
                </p>
                <button
                  appButton
                  variant="line"
                  size="sm"
                  type="button"
                  class="self-start"
                  (click)="askCancel()"
                >
                  {{ 'portal.interview.cancel' | transloco }}
                </button>
              } @else if (slots().length) {
                <p>{{ 'portal.interview.choose' | transloco }}</p>
                <ul class="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                  @for (slot of slots(); track slot.id) {
                    <li class="flex flex-col gap-3 rounded-[14px] border border-border p-4">
                      <strong>{{ when(slot.startsAt) }}</strong>
                      @if (slot.location) {
                        <span class="t-caption">{{ slot.location }}</span>
                      }
                      <button appButton size="sm" type="button" (click)="askBook(slot)">
                        {{ 'portal.interview.book' | transloco }}
                      </button>
                    </li>
                  }
                </ul>
              } @else {
                <p class="t-muted">{{ 'portal.interview.none' | transloco }}</p>
              }
              @if (interviewError(); as key) {
                <p class="note note-warn" role="alert">{{ key | transloco }}</p>
              }
            </section>
          }
        </div>

        <aside class="flex flex-col gap-6">
          <section class="card flex flex-col gap-4" aria-labelledby="portal-summary">
            <h2 id="portal-summary" class="t-h4 text-xl">
              {{ 'portal.status.summary' | transloco }}
            </h2>
            <dl class="m-0 flex flex-col gap-3">
              @for (row of summary(); track row.label) {
                <div class="flex items-start justify-between gap-4">
                  <dt class="t-muted">{{ row.label }}</dt>
                  <dd class="m-0 text-end font-semibold">
                    {{ row.value || ('common.placeholder' | transloco) }}
                  </dd>
                </div>
              }
            </dl>
            @if (m.status === 'draft') {
              <a
                class="border-t border-border pt-3 font-semibold"
                [routerLink]="locale.link('/apply')"
                >{{ 'portal.status.continueApply' | transloco }}</a
              >
            }
          </section>

          <section class="card flex flex-col gap-4" aria-labelledby="portal-updates">
            <h2 id="portal-updates" class="t-h4 text-xl">
              {{ 'portal.status.updates' | transloco }}
            </h2>
            @if (events().length) {
              <ol class="m-0 flex list-none flex-col gap-4 p-0">
                @for (e of events(); track e.id; let first = $first) {
                  <li class="flex items-start gap-3">
                    <span
                      class="mt-2 size-2.5 shrink-0 rounded-full"
                      [class.bg-secondary]="first"
                      [class.bg-border]="!first"
                      aria-hidden="true"
                    ></span>
                    <span class="flex flex-col">
                      <strong class="t-small">{{ eventLabel(e) }}</strong>
                      <time class="t-caption" [attr.datetime]="e.createdAt">{{
                        e.createdAt | relTime
                      }}</time>
                    </span>
                  </li>
                }
              </ol>
            } @else {
              <p class="t-muted">{{ 'portal.status.noUpdates' | transloco }}</p>
            }
          </section>

          <section class="card border-0 !bg-secondary-light" aria-labelledby="portal-help">
            <h2 id="portal-help" class="t-h4 text-[19px]">
              {{ 'portal.status.help' | transloco }}
            </h2>
            <p class="mt-2 mb-3 text-primary">{{ 'portal.status.helpBody' | transloco }}</p>
            <a class="font-semibold !text-primary" [routerLink]="locale.link('/contact')">{{
              'portal.status.helpLink' | transloco
            }}</a>
          </section>
        </aside>
      </div>
    }

    <ng-template #confirmTpl>
      <app-dialog-frame [heading]="confirm()?.title ?? ''" headingId="portal-confirm-title">
        <p>{{ confirm()?.body }}</p>
        @if (interviewError(); as key) {
          <p class="note note-warn mt-4" role="alert">{{ key | transloco }}</p>
        }
        <button dialogActions appButton variant="line" type="button" (click)="closeDialog()">
          {{ 'portal.interview.keep' | transloco }}
        </button>
        <button
          dialogActions
          appButton
          type="button"
          [busy]="busy()"
          [disabled]="busy()"
          (click)="confirmAction()"
        >
          {{ confirm()?.action ?? '' }}
        </button>
      </app-dialog-frame>
    </ng-template>
  `,
})
export class PortalStatus {
  protected readonly locale = inject(LocaleService);
  private readonly store = inject(ApplicantSessionStore);
  private readonly api = inject(PortalApi);
  private readonly t = inject(TranslocoService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly me = this.store.me;
  protected readonly events = signal<PortalEvent[]>([]);
  protected readonly slots = signal<InterviewSlot[]>([]);
  protected readonly busy = signal(false);
  protected readonly interviewError = signal<string | null>(null);
  protected readonly confirm = signal<{
    title: string;
    body: string;
    action: string;
    run: () => Promise<void>;
  } | null>(null);

  private readonly confirmTpl = viewChild.required<TemplateRef<unknown>>('confirmTpl');
  private dialogRef: DialogRef<unknown, unknown> | null = null;

  protected readonly timeline = computed<TimelineItem[]>(() => {
    this.locale.lang();
    return (this.me()?.timeline ?? []).map((step) => ({
      key: step.key,
      label: this.t.translate(`portal.status.steps.${step.key}`),
      state: step.state,
      caption: this.t.translate(`ui.timeline.${step.state}`),
    }));
  });

  protected readonly summary = computed(() => {
    const m = this.me();
    const lang = this.locale.lang();
    const p = m?.personal;
    let nationality = p?.nationality ?? '';
    try {
      nationality = nationality
        ? (new Intl.DisplayNames([lang], { type: 'region' }).of(nationality) ?? nationality)
        : '';
    } catch {
      // keep the code
    }
    return [
      {
        label: this.t.translate('portal.status.name'),
        value: [p?.firstName, p?.middleName, p?.lastName].filter(Boolean).join(' '),
      },
      { label: this.t.translate('portal.status.nationality'), value: nationality },
      { label: this.t.translate('portal.status.university'), value: m?.study.university ?? '' },
      {
        label: this.t.translate('portal.status.degree'),
        value: m?.study.degreeLevel
          ? this.t.translate(`pages.apply.degree.${m.study.degreeLevel}`)
          : '',
      },
    ];
  });

  constructor() {
    inject(SeoService).noindex(this.t.translate('portal.nav.status'), this.locale.lang());
    void this.load();
  }

  private async load(): Promise<void> {
    await this.store.refresh();
    const m = this.me();
    const [events, slots] = await Promise.all([
      firstValueFrom(this.api.notifications(1, 8))
        .then((page) => page.data)
        .catch(() => m?.recentEvents ?? []),
      m?.status === 'interview' && !m.interview
        ? firstValueFrom(this.api.interviewSlots()).catch(() => [] as InterviewSlot[])
        : Promise.resolve([] as InterviewSlot[]),
    ]);
    this.events.set(events.slice(0, 8));
    this.slots.set(slots);
  }

  protected docLabel(type: string | undefined): string {
    return type ? this.t.translate(`docType.${type}`) : '';
  }

  protected docLabels(types: string[] | undefined): string {
    return (types ?? [])
      .map((t) => this.docLabel(t))
      .join(this.locale.lang() === 'ar' ? '، ' : ', ');
  }

  protected eventLabel(e: PortalEvent): string {
    return this.t.translate(`portal.events.${KNOWN_EVENTS.has(e.type) ? e.type : 'other'}`);
  }

  protected when(iso: string): string {
    return (
      formatDate(iso, 'long', this.locale.intlLocale()) +
      ' · ' +
      new Intl.DateTimeFormat(this.locale.intlLocale(), {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(iso))
    );
  }

  protected askBook(slot: InterviewSlot): void {
    this.openConfirm({
      title: this.t.translate('portal.interview.confirmTitle'),
      body: this.t.translate('portal.interview.confirmBody', { date: this.when(slot.startsAt) }),
      action: this.t.translate('portal.interview.confirm'),
      run: async () => {
        await firstValueFrom(this.api.bookInterview(slot.id));
        this.toast.success(this.t.translate('portal.interview.bookedToast'));
      },
    });
  }

  protected askCancel(): void {
    this.openConfirm({
      title: this.t.translate('portal.interview.cancelTitle'),
      body: this.t.translate('portal.interview.cancelBody'),
      action: this.t.translate('portal.interview.cancelConfirm'),
      run: async () => {
        await firstValueFrom(this.api.cancelInterview());
        this.toast.success(this.t.translate('portal.interview.cancelledToast'));
      },
    });
  }

  private openConfirm(c: {
    title: string;
    body: string;
    action: string;
    run: () => Promise<void>;
  }): void {
    this.interviewError.set(null);
    this.confirm.set(c);
    this.dialogRef = this.dialog.open(this.confirmTpl(), {
      ariaLabelledBy: 'portal-confirm-title',
    });
  }

  protected closeDialog(): void {
    this.dialogRef?.close();
    this.dialogRef = null;
  }

  protected async confirmAction(): Promise<void> {
    const c = this.confirm();
    if (!c || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.interviewError.set(null);
    try {
      await c.run();
      this.closeDialog();
      await this.load();
    } catch (error) {
      const problem = toApiProblem(error);
      this.interviewError.set(
        problem.status === 429 ? 'portal.interview.rateLimited' : problemMessageKey(problem),
      );
      if (problem.code === 'SLOT_ALREADY_BOOKED') {
        void this.load();
      }
    } finally {
      this.busy.set(false);
    }
  }
}
