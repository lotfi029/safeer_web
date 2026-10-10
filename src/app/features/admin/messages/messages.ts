import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from '../../../core/api/admin/admin-api';
import type {
  AdminMessage,
  ConvertToTestimonialBody,
  MessageStatus,
} from '../../../core/api/admin/admin-models';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { StaffSessionStore } from '../../../core/auth/staff-session.store';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { DigitsPipe, LocalDatePipe, RelTimePipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { DialogService } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { Pill } from '../../../shared/ui/status-pill/status-pill';
import { ToastService } from '../../../shared/ui/toast/toast';
import { AdminBadges } from '../layout/admin-badges';
import { AdminPageHead } from '../layout/admin-page-head';
import { confirmAction } from '../shared/confirm-dialog';
import { ConvertDialog } from './convert-dialog';

const STATUSES: readonly MessageStatus[] = ['unread', 'read', 'archived'];
const PAGE_SIZE = 20;

export function messageStatusParam(value: string | null | undefined): MessageStatus | null {
  return STATUSES.includes(value as MessageStatus) ? (value as MessageStatus) : null;
}

/**
 * Messages (prototype `aMessages`): the list and the open message side by side at lg+; below lg the
 * list and `messages/:id` are separate screens. Opening a message marks it read (the API does);
 * reply mails the sender; archive / mark unread; convert to a pending testimonial; delete needs
 * `inbox.delete`.
 */
@Component({
  selector: 'app-admin-messages',
  imports: [
    RouterLink,
    TranslocoPipe,
    DigitsPipe,
    LocalDatePipe,
    RelTimePipe,
    Button,
    Icon,
    Pagination,
    Pill,
    AdminPageHead,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-admin-page-head
      [heading]="'admin.messages.title' | transloco"
      [sub]="
        list.value()
          ? ('admin.messages.summary'
            | transloco
              : {
                  total: (list.value()!.total | digits),
                  unread: (list.value()!.unreadCount | digits),
                })
          : null
      "
    />

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <section
        class="card card-flush flex flex-col"
        [class.max-lg:hidden]="!!id()"
        [attr.aria-label]="'admin.messages.list' | transloco"
      >
        <div
          class="flex flex-wrap gap-2 border-b border-border p-4"
          role="group"
          [attr.aria-label]="'admin.messages.filters' | transloco"
        >
          @for (f of filters; track f.value) {
            <a
              class="chip"
              [routerLink]="locale.link('/admin/messages')"
              [queryParams]="{ status: f.value }"
              [attr.aria-current]="statusFilter() === f.value ? 'page' : null"
              >{{ 'admin.messages.status.' + f.key | transloco }}</a
            >
          }
        </div>
        @if (list.error()) {
          <p class="note note-warn m-4" role="alert">{{ 'admin.common.loadError' | transloco }}</p>
        } @else if (list.value(); as res) {
          @if (res.data.length) {
            <ul class="m-0 flex list-none flex-col p-0" data-testid="message-list">
              @for (m of res.data; track m.id) {
                <li class="border-b border-border last:border-b-0">
                  <a
                    class="flex flex-col gap-1 border-s-4 px-4 py-4 text-text no-underline hover:bg-raise"
                    [class]="m.id === id() ? 'border-secondary bg-raise' : 'border-transparent'"
                    [routerLink]="locale.link('/admin/messages/' + m.id)"
                    queryParamsHandling="preserve"
                    [attr.aria-current]="m.id === id() ? 'true' : null"
                  >
                    <span class="flex items-center justify-between gap-3">
                      <span class="flex min-w-0 items-center gap-2">
                        @if (m.status === 'unread') {
                          <span
                            class="block size-2 shrink-0 rounded-full bg-secondary"
                            aria-hidden="true"
                          ></span>
                          <span class="sr-only"
                            >{{ 'admin.messages.status.unread' | transloco }}:</span
                          >
                        }
                        <strong
                          class="truncate text-heading"
                          [class.font-semibold]="m.status !== 'unread'"
                          >{{ m.name }}</strong
                        >
                      </span>
                      <span class="t-caption shrink-0 text-text-muted">{{
                        m.createdAt | relTime
                      }}</span>
                    </span>
                    <span class="t-small font-semibold text-secondary-text">{{
                      'pages.contact.subjects.' + m.subject | transloco
                    }}</span>
                    <span class="t-small line-clamp-2 text-text-muted">{{ m.excerpt }}</span>
                  </a>
                </li>
              }
            </ul>
            @if (res.total > pageSize) {
              <div class="border-t border-border p-3">
                <app-pagination [page]="page()" [total]="res.total" [pageSize]="pageSize" />
              </div>
            }
          } @else {
            <p class="t-muted m-0 p-6 text-center">{{ 'admin.messages.empty' | transloco }}</p>
          }
        } @else {
          <div class="flex flex-col gap-3 p-4" aria-hidden="true">
            @for (i of [1, 2, 3]; track i) {
              <span class="skeleton h-16"></span>
            }
          </div>
        }
      </section>

      <section class="min-w-0" [class.max-lg:hidden]="!id()" aria-live="polite">
        @if (id()) {
          <a
            class="mb-3 inline-flex items-center gap-1 font-semibold text-secondary-text lg:hidden"
            [routerLink]="locale.link('/admin/messages')"
            queryParamsHandling="preserve"
          >
            <app-icon name="arrow-left" [size]="18" />{{ 'admin.messages.back' | transloco }}
          </a>
          @if (message.error() && !message.hasValue()) {
            <p class="note note-warn" role="alert">{{ messageErrorKey() | transloco }}</p>
          } @else if (message.value(); as m) {
            <article class="card flex flex-col gap-6" data-testid="message-detail">
              <header
                class="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <span class="icon-tile size-12 shrink-0 text-lg font-bold" aria-hidden="true">{{
                    initial(m.name)
                  }}</span>
                  <div class="flex min-w-0 flex-col">
                    <h2 class="t-h3 m-0 truncate text-heading">{{ m.name }}</h2>
                    <p class="t-small m-0 text-text-muted" dir="ltr">
                      <a [href]="'mailto:' + m.email">{{ m.email }}</a>
                      @if (m.phone) {
                        · <bdi>{{ m.phone }}</bdi>
                      }
                    </p>
                  </div>
                </div>
                <app-pill
                  [variant]="
                    m.status === 'archived' ? 'plain' : m.status === 'unread' ? 'warn' : 'ok'
                  "
                  >{{ 'admin.messages.status.' + m.status | transloco }}</app-pill
                >
              </header>
              <div class="flex flex-col gap-1">
                <p class="t-small m-0 text-text-muted">
                  {{ 'admin.messages.subject' | transloco }}
                </p>
                <p class="t-h4 m-0 text-heading">
                  {{ 'pages.contact.subjects.' + m.subject | transloco }}
                </p>
                <p class="t-caption m-0 text-text-muted">
                  {{
                    'admin.messages.received'
                      | transloco: { date: (m.createdAt | localDate: 'datetime') }
                  }}
                </p>
              </div>
              <div class="rounded-card bg-raise p-5 whitespace-pre-line" data-testid="message-body">
                {{ m.body }}
              </div>

              @if (m.replies.length) {
                <div class="flex flex-col gap-3">
                  <h3 class="t-h4 m-0 text-heading">{{ 'admin.messages.replies' | transloco }}</h3>
                  <ul class="m-0 flex list-none flex-col gap-3 p-0" data-testid="message-replies">
                    @for (r of m.replies; track r.id) {
                      <li class="rounded-card border border-border p-4">
                        <p class="m-0 whitespace-pre-line">{{ r.body }}</p>
                        <p class="t-caption m-0 mt-2 text-text-muted">
                          {{ r.authorName || ('admin.common.system' | transloco) }} ·
                          {{ r.createdAt | localDate: 'datetime' }}
                        </p>
                      </li>
                    }
                  </ul>
                </div>
              }

              <div class="flex flex-col gap-2">
                <label class="field-label" for="message-reply">{{
                  'admin.messages.reply.label' | transloco
                }}</label>
                <textarea
                  id="message-reply"
                  class="control"
                  rows="5"
                  maxlength="5000"
                  [placeholder]="'admin.messages.reply.placeholder' | transloco"
                  [value]="reply()"
                  (input)="reply.set($any($event.target).value)"
                ></textarea>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <button
                  appButton
                  type="button"
                  [busy]="busy()"
                  [disabled]="busy() || !reply().trim()"
                  (click)="sendReply(m)"
                >
                  <app-icon name="send" [size]="18" />{{ 'admin.messages.reply.send' | transloco }}
                </button>
                @if (m.status === 'archived') {
                  <button
                    appButton
                    variant="line"
                    type="button"
                    [disabled]="busy()"
                    (click)="setStatus(m, 'read')"
                  >
                    <app-icon name="archive-restore" [size]="18" />{{
                      'admin.messages.unarchive' | transloco
                    }}
                  </button>
                } @else {
                  <button
                    appButton
                    variant="line"
                    type="button"
                    [disabled]="busy()"
                    (click)="setStatus(m, 'archived')"
                  >
                    <app-icon name="archive" [size]="18" />{{
                      'admin.messages.archive' | transloco
                    }}
                  </button>
                  <button
                    appButton
                    variant="ghost"
                    type="button"
                    [disabled]="busy()"
                    (click)="setStatus(m, 'unread')"
                  >
                    <app-icon name="mail" [size]="18" />{{
                      'admin.messages.markUnread' | transloco
                    }}
                  </button>
                }
                <span class="grow"></span>
                <button
                  appButton
                  variant="soft"
                  type="button"
                  [disabled]="busy()"
                  (click)="convert(m)"
                >
                  <app-icon name="quote" [size]="18" />{{
                    'admin.messages.convert.button' | transloco
                  }}
                </button>
                @if (canDelete()) {
                  <button
                    appButton
                    variant="danger"
                    type="button"
                    [disabled]="busy()"
                    (click)="remove(m)"
                  >
                    <app-icon name="trash-2" [size]="18" />{{ 'admin.messages.delete' | transloco }}
                  </button>
                }
              </div>
            </article>
          } @else {
            <div class="card flex flex-col gap-3" aria-hidden="true">
              <span class="skeleton h-8 w-1/2"></span>
              <span class="skeleton h-24"></span>
            </div>
          }
        } @else {
          <div
            class="card flex min-h-60 flex-col items-center justify-center gap-3 text-center text-text-muted"
          >
            <app-icon name="mail-open" [size]="32" class="text-decor" />
            <p class="m-0">{{ 'admin.messages.pick' | transloco }}</p>
          </div>
        }
      </section>
    </div>
  `,
})
export class MessagesPage {
  /** Route param (`messages/:id`); absent on the list route. */
  readonly id = input<string | undefined>();
  readonly status = input<string | null>(null);
  /** Query param `?page=`. */
  readonly page = input(1, { transform: (v: unknown) => numberAttribute(v, 1) });

  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly badges = inject(AdminBadges);
  private readonly store = inject(StaffSessionStore);
  protected readonly locale = inject(LocaleService);
  protected readonly pageSize = PAGE_SIZE;

  protected readonly filters = [
    { key: 'all', value: null },
    ...STATUSES.map((s) => ({ key: s, value: s })),
  ] as const;
  protected readonly statusFilter = computed(() => messageStatusParam(this.status()));
  private readonly reload = signal(0);

  protected readonly list = rxResource({
    params: () => ({
      query: { status: this.statusFilter(), page: Math.max(1, this.page()), limit: PAGE_SIZE },
      reload: this.reload(),
    }),
    stream: ({ params }) => this.api.messages(params.query),
  });
  protected readonly message = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.message(params),
  });

  protected readonly reply = signal('');
  protected readonly busy = signal(false);
  protected readonly canDelete = computed(() => this.store.can('inbox.delete'));
  protected readonly messageErrorKey = computed(() => {
    const err = this.message.error();
    return err ? problemMessageKey(toApiProblem(err)) : 'admin.common.loadError';
  });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
    // Opening a message marks it read on the API: refresh the list's dots and the sidebar badge.
    let lastOpened: string | undefined;
    effect(() => {
      const opened = this.message.value();
      if (opened && opened.id !== lastOpened) {
        lastOpened = opened.id;
        untracked(() => {
          this.reply.set('');
          this.refreshAll();
        });
      }
    });
  }

  protected initial(name: string): string {
    const first = name.trim()[0] ?? '';
    return /\p{L}/u.test(first) ? first : '•';
  }

  private toastError(error: unknown): void {
    this.toasts.show({
      kind: 'error',
      message: this.t.translate(problemMessageKey(toApiProblem(error))),
    });
  }

  private refreshAll(): void {
    this.reload.update((n) => n + 1);
    void this.badges.refresh();
  }

  protected async sendReply(m: AdminMessage): Promise<void> {
    const body = this.reply().trim();
    if (!body) return;
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.api.reply(m.id, body));
      this.message.set({ ...m, status: res.message.status, replies: [...m.replies, res.reply] });
      this.reply.set('');
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.messages.reply.sent') });
      this.refreshAll();
    } catch (error) {
      this.toastError(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async setStatus(m: AdminMessage, status: MessageStatus): Promise<void> {
    this.busy.set(true);
    try {
      const updated = await firstValueFrom(this.api.setMessageStatus(m.id, status));
      this.message.set({ ...m, status: updated.status });
      if (status === 'archived') {
        this.toasts.show({ kind: 'success', message: this.t.translate('admin.messages.archived') });
      }
      this.refreshAll();
    } catch (error) {
      this.toastError(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async convert(m: AdminMessage): Promise<void> {
    const ref = this.dialogs.open<ConvertToTestimonialBody>(ConvertDialog, {
      data: { body: m.body, name: m.name },
      ariaLabelledBy: 'convert-title',
      width: 'min(640px, calc(100vw - 32px))',
    });
    const body = await firstValueFrom(ref.closed);
    if (!body) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.convertToTestimonial(m.id, body));
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.messages.convert.done'),
      });
    } catch (error) {
      this.toastError(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(m: AdminMessage): Promise<void> {
    const ok = await confirmAction(this.dialogs, {
      heading: this.t.translate('admin.messages.delete'),
      body: this.t.translate('admin.messages.deleteConfirm'),
      confirm: this.t.translate('admin.common.delete'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteMessage(m.id));
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.messages.deleted') });
      this.refreshAll();
      await this.router.navigate([this.locale.link('/admin/messages')], {
        queryParamsHandling: 'preserve',
      });
    } catch (error) {
      this.toastError(error);
    } finally {
      this.busy.set(false);
    }
  }
}
