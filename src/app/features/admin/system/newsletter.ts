import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { saveBlob } from '../../../core/api/admin/admin-api';
import {
  type Subscriber,
  type SubscriberStatus,
  subscriberStatus,
  SystemApi,
} from '../../../core/api/admin/system-api';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { DigitsPipe, LocalDatePipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { DialogService } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { ToastService } from '../../../shared/ui/toast/toast';
import { AdminPageHead } from '../layout/admin-page-head';
import { confirmAction } from '../shared/confirm-dialog';

const STATUSES: readonly SubscriberStatus[] = ['subscribed', 'pending', 'unsubscribed'];
const PAGE = 20;

/**
 * Newsletter subscribers (inbox, `GET admin/newsletter`): status tabs (double opt-in: pending until the
 * emailed link is used), CSV export of the current tab, delete.
 */
@Component({
  selector: 'app-admin-newsletter',
  imports: [
    RouterLink,
    TranslocoPipe,
    DigitsPipe,
    LocalDatePipe,
    Button,
    Icon,
    Pagination,
    AdminPageHead,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-admin-page-head
      [heading]="'admin.system.newsletter.title' | transloco"
      [sub]="
        list.value()
          ? ('admin.system.newsletter.count' | transloco: { count: (list.value()!.total | digits) })
          : null
      "
    >
      <button
        pageActions
        appButton
        variant="line"
        size="sm"
        type="button"
        [busy]="busy()"
        [disabled]="busy()"
        (click)="exportCsv()"
      >
        <app-icon name="download" [size]="18" />{{ 'admin.applications.export' | transloco }}
      </button>
    </app-admin-page-head>
    <nav
      class="mb-5 flex flex-wrap gap-2"
      [attr.aria-label]="'admin.system.newsletter.filters' | transloco"
    >
      <a
        class="chip"
        [routerLink]="[]"
        [queryParams]="{ status: null, page: null }"
        [attr.aria-current]="!current() ? 'page' : null"
        >{{ 'admin.content.all' | transloco }}</a
      >
      @for (s of statuses; track s) {
        <a
          class="chip"
          [routerLink]="[]"
          [queryParams]="{ status: s, page: null }"
          [attr.aria-current]="current() === s ? 'page' : null"
          >{{ 'admin.system.newsletter.status.' + s | transloco }}</a
        >
      }
    </nav>
    @if (list.value(); as res) {
      @if (res.data.length) {
        <ul class="m-0 flex list-none flex-col gap-2 p-0" data-testid="subscriber-rows">
          @for (s of res.data; track s.id) {
            <li
              class="card flex flex-wrap items-center gap-3 p-3 md:p-4"
              [attr.data-email]="s.email"
            >
              <div class="flex min-w-0 flex-1 basis-56 flex-col">
                <span class="truncate font-semibold text-heading" dir="ltr">{{ s.email }}</span>
                <span class="t-small text-text-muted"
                  >{{
                    'admin.system.newsletter.since'
                      | transloco: { date: (s.createdAt | localDate: 'medium') }
                  }}
                  · {{ s.locale === 'ar' ? 'العربية' : 'English' }}</span
                >
              </div>
              <span
                class="pill"
                [class.pill-ok]="statusOf(s) === 'subscribed'"
                [class.pill-plain]="statusOf(s) === 'pending'"
                [class.pill-warn]="statusOf(s) === 'unsubscribed'"
                >{{ 'admin.system.newsletter.status.' + statusOf(s) | transloco }}</span
              >
              <button
                type="button"
                class="icon-btn size-11 text-alert"
                [attr.aria-label]="('admin.common.delete' | transloco) + ': ' + s.email"
                [disabled]="busy()"
                (click)="remove(s)"
              >
                <app-icon name="trash-2" [size]="18" />
              </button>
            </li>
          }
        </ul>
        <app-pagination [page]="page()" [total]="res.total" [pageSize]="pageSize" />
      } @else {
        <p class="card t-muted m-0">{{ 'admin.content.empty' | transloco }}</p>
      }
    } @else if (list.error()) {
      <p class="note note-warn" role="alert">{{ 'admin.common.loadError' | transloco }}</p>
    } @else {
      <span class="skeleton block h-40" aria-hidden="true"></span>
    }
  `,
})
export class AdminNewsletter {
  readonly status = input<string | null>(null);
  readonly page = input(1, { transform: (v: unknown) => numberAttribute(v, 1) });

  private readonly api = inject(SystemApi);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly doc = inject(DOCUMENT);
  private readonly locale = inject(LocaleService);
  protected readonly statuses = STATUSES;
  protected readonly pageSize = PAGE;
  protected readonly busy = signal(false);
  private readonly reload = signal(0);
  protected readonly current = computed(() =>
    STATUSES.includes(this.status() as SubscriberStatus)
      ? (this.status() as SubscriberStatus)
      : null,
  );
  protected readonly list = rxResource({
    params: () => ({
      q: { status: this.current(), page: this.page(), limit: PAGE },
      reload: this.reload(),
    }),
    stream: ({ params }) => this.api.subscribers(params.q),
  });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
  }

  protected statusOf(s: Subscriber): SubscriberStatus {
    return subscriberStatus(s);
  }

  protected async exportCsv(): Promise<void> {
    this.busy.set(true);
    try {
      const file = await firstValueFrom(this.api.exportSubscribers(this.current()));
      saveBlob(this.doc, file.blob, file.filename);
    } catch (error) {
      this.toasts.show({
        kind: 'error',
        message: this.t.translate(problemMessageKey(toApiProblem(error))),
      });
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(s: Subscriber): Promise<void> {
    const ok = await confirmAction(this.dialogs, {
      heading: this.t.translate('admin.common.confirmDelete'),
      body: this.t.translate('admin.content.deleteConfirm', { title: s.email }),
      confirm: this.t.translate('admin.common.delete'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteSubscriber(s.id));
      this.reload.update((n) => n + 1);
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.deleted') });
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
