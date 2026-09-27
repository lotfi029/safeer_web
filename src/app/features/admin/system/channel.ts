import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
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
import {
  type Channel,
  type LogStatus,
  type MailSettings,
  type MessageLog,
  type MessageTemplate,
  type SmsSettings,
  SystemApi,
} from '../../../core/api/admin/system-api';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { LocalDatePipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { DialogFrame, DialogService } from '../../../shared/ui/dialog/dialog';
import { Control, Field, type FieldErrorLike } from '../../../shared/ui/field/field';
import { Icon } from '../../../shared/ui/icon/icon';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { RichText } from '../../../shared/ui/rich-text/rich-text';
import { ToastService } from '../../../shared/ui/toast/toast';
import { type CrudField, modelFromRow, toBody, validate } from '../content/crud/crud-config';
import { CrudFields, toFieldErrors } from '../content/crud/crud-fields';
import { AdminPageHead } from '../layout/admin-page-head';

const TABS = ['settings', 'templates', 'log'] as const;
type Tab = (typeof TABS)[number];
const STATUSES: readonly LogStatus[] = ['queued', 'sent', 'failed', 'skipped'];
const LOG_PAGE = 50;

/** Settings fields per channel (mail-settings / sms-settings DTOs; the secret is handled apart). */
export const CHANNEL_FIELDS: Record<Channel, readonly CrudField[]> = {
  mail: [
    { key: 'isEnabled', type: 'boolean', label: 'isEnabled' },
    { key: 'driver', type: 'select', label: 'driver', options: ['log', 'smtp'], required: true },
    { key: 'host', type: 'url', label: 'host', max: 191, nullable: true },
    { key: 'port', type: 'number', label: 'port', nullable: true },
    {
      key: 'encryption',
      type: 'select',
      label: 'encryption',
      options: ['starttls', 'tls', 'none'],
      required: true,
    },
    { key: 'username', type: 'url', label: 'username', max: 191, nullable: true },
    { key: 'fromName', type: 'text', label: 'fromName', bilingual: true, max: 120, nullable: true },
    { key: 'fromEmail', type: 'url', label: 'fromEmail', max: 191, nullable: true },
    { key: 'replyTo', type: 'url', label: 'replyTo', max: 191, nullable: true },
    {
      key: 'notifyEmail',
      type: 'url',
      label: 'contactInbox',
      max: 191,
      nullable: true,
      hint: 'notifyEmailHint',
    },
  ],
  sms: [
    { key: 'isEnabled', type: 'boolean', label: 'isEnabled' },
    {
      key: 'driver',
      type: 'select',
      label: 'smsDriver',
      options: ['log', 'http', 'unifonic'],
      required: true,
    },
    { key: 'providerUrl', type: 'url', label: 'providerUrl', max: 500, nullable: true },
    {
      key: 'senderName',
      type: 'text',
      label: 'senderName',
      max: 120,
      nullable: true,
      hint: 'senderHint',
    },
  ],
};

/** Template fields (mail has a subject and a Markdown body; SMS bodies are plain, ≤ 480). */
export function templateFields(channel: Channel): CrudField[] {
  return [
    { key: 'name', type: 'text', label: 'templateName', bilingual: true, required: true, max: 191 },
    ...(channel === 'mail'
      ? ([
          {
            key: 'subject',
            type: 'text',
            label: 'subject',
            bilingual: true,
            required: true,
            max: 255,
          },
        ] as CrudField[])
      : []),
    channel === 'mail'
      ? {
          key: 'body',
          type: 'markdown',
          label: 'templateBody',
          bilingual: true,
          required: true,
          nullable: true,
        }
      : {
          key: 'body',
          type: 'textarea',
          label: 'templateBody',
          bilingual: true,
          required: true,
          max: 480,
          nullable: true,
        },
    { key: 'isEnabled', type: 'boolean', label: 'templateEnabled' },
  ];
}

/** Placeholders the template uses that it doesn't declare (the API answers UNKNOWN_VARIABLE). */
export function unknownVariables(texts: readonly unknown[], allowed: readonly string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const m of String(text ?? '').matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
      if (!allowed.includes(m[1])) found.add(m[1]);
    }
  }
  return [...found];
}

/** Edit one template: fields, its variables (click to copy the placeholder), and a server preview. */
@Component({
  selector: 'app-template-editor',
  imports: [TranslocoPipe, Button, DialogFrame, CrudFields, RichText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame
      [heading]="'admin.system.channel.editTemplate' | transloco: { key: data.template.key }"
      headingId="template-title"
    >
      <form class="flex flex-col gap-5" id="template-form" novalidate (submit)="save($event)">
        <div class="flex flex-col gap-2">
          <p class="field-label m-0">{{ 'admin.system.channel.variables' | transloco }}</p>
          <ul class="m-0 flex list-none flex-wrap gap-2 p-0" data-testid="template-variables">
            @for (v of data.template.variables; track v) {
              <li>
                <code class="chip" dir="ltr">{{ placeholder(v) }}</code>
              </li>
            }
          </ul>
          <p class="field-hint m-0">{{ 'admin.system.channel.variablesHint' | transloco }}</p>
        </div>
        <app-crud-fields [fields]="fields" [(model)]="model" [errors]="errors()" />
        @if (unknown().length && tried()) {
          <p class="note note-warn m-0" role="alert">
            {{
              'admin.system.channel.unknownVariables' | transloco: { names: unknown().join(', ') }
            }}
          </p>
        }
        @if (errorKey(); as key) {
          <p class="note note-warn m-0" role="alert">{{ key | transloco }}</p>
        }
        @if (preview(); as p) {
          <div
            class="flex flex-col gap-2 rounded-card border border-border p-4"
            data-testid="template-preview"
          >
            @if (p.subject) {
              <strong>{{ p.subject }}</strong>
            }
            @if (p.html) {
              <app-rich-text [html]="p.html" />
            } @else {
              <p class="m-0 whitespace-pre-line">{{ p.message ?? p.text }}</p>
            }
          </div>
        }
      </form>
      <button
        dialogActions
        appButton
        variant="line"
        type="button"
        [disabled]="busy()"
        (click)="showPreview()"
      >
        {{ 'admin.system.channel.preview' | transloco }}
      </button>
      <button dialogActions appButton variant="ghost" type="button" (click)="ref.close()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        dialogActions
        appButton
        type="submit"
        form="template-form"
        [busy]="busy()"
        [disabled]="busy()"
      >
        {{ 'common.save' | transloco }}
      </button>
    </app-dialog-frame>
  `,
})
export class TemplateEditor {
  protected readonly data = inject<{ channel: Channel; template: MessageTemplate }>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<MessageTemplate>>(DialogRef);
  private readonly api = inject(SystemApi);
  private readonly t = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  protected readonly fields = templateFields(this.data.channel);
  protected readonly model = signal<Record<string, unknown>>(
    modelFromRow(this.fields, this.data.template as never),
  );
  protected readonly busy = signal(false);
  protected readonly tried = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly preview = signal<{
    subject?: string;
    html?: string;
    text?: string;
    message?: string;
  } | null>(null);
  private readonly server = signal<Record<string, string[]>>({});
  private readonly client = computed(() => validate(this.fields, this.model()));
  protected readonly unknown = computed(() => {
    const m = this.model();
    return unknownVariables(
      [m['subjectAr'], m['subjectEn'], m['bodyAr'], m['bodyEn']],
      this.data.template.variables,
    );
  });
  protected readonly errors = computed<Record<string, FieldErrorLike[]>>(() => {
    const out = this.tried()
      ? toFieldErrors(this.client(), this.fields, (k) => this.t.translate(k))
      : {};
    for (const [key, messages] of Object.entries(this.server())) {
      out[key] = [...(out[key] ?? []), ...messages.map((message) => ({ kind: 'server', message }))];
    }
    return out;
  });

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    this.errorKey.set(null);
    this.server.set({});
    if (Object.keys(this.client()).length || this.unknown().length) return;
    this.busy.set(true);
    try {
      const saved = await firstValueFrom(
        this.api.saveTemplate(
          this.data.channel,
          this.data.template.key,
          toBody(this.fields, this.model(), 'update'),
        ),
      );
      this.ref.close(saved);
    } catch (error) {
      const problem = toApiProblem(error);
      this.server.set(problem.fieldErrors);
      this.errorKey.set(
        problem.code === 'UNKNOWN_VARIABLE'
          ? this.t.translate('admin.system.channel.unknownVariables', {
              names: String(problem.extra['variable'] ?? ''),
            })
          : problemMessageKey(problem),
      );
    } finally {
      this.busy.set(false);
    }
  }

  /** The saved template rendered by the API with `[name]` for each variable (nothing is sent). */
  /** `{{ name }}`, the placeholder syntax the API expands. */
  protected placeholder(name: string): string {
    return `{{ ${name} }}`;
  }

  protected async showPreview(): Promise<void> {
    this.busy.set(true);
    try {
      this.preview.set(
        await firstValueFrom(
          this.api.previewTemplate(this.data.channel, this.data.template.key, this.locale.lang()),
        ),
      );
    } catch (error) {
      this.errorKey.set(problemMessageKey(toApiProblem(error)));
    } finally {
      this.busy.set(false);
    }
  }
}

/**
 * Mail or SMS (route data `channel`): provider settings with a test send (the password/token is never
 * shown: leave it empty to keep it), templates with their variables and a preview, and the send log
 * (mail rows can be retried; SMS logs never carry the message, so OTP codes stay hidden).
 */
@Component({
  selector: 'app-admin-channel',
  imports: [
    RouterLink,
    TranslocoPipe,
    LocalDatePipe,
    Button,
    Field,
    Control,
    Icon,
    Pagination,
    AdminPageHead,
    CrudFields,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-admin-page-head [heading]="'admin.system.channel.' + channel() + '.title' | transloco" />
    <nav
      class="mb-6 flex flex-wrap gap-2"
      [attr.aria-label]="'admin.system.channel.tabs' | transloco"
    >
      @for (t of tabs; track t) {
        <a
          class="chip"
          [routerLink]="[]"
          [queryParams]="{
            tab: t === 'settings' ? null : t,
            page: null,
            status: null,
            template: null,
          }"
          [attr.aria-current]="current() === t ? 'page' : null"
          >{{ 'admin.system.channel.tab.' + t | transloco }}</a
        >
      }
    </nav>

    @switch (current()) {
      @case ('settings') {
        @if (settings.value(); as s) {
          <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <form
              class="card flex flex-col gap-5"
              novalidate
              (submit)="saveSettings($event)"
              id="channel-form"
            >
              <app-crud-fields [fields]="fields()" [(model)]="model" [errors]="errors()" />
              <app-field
                [label]="
                  (channel() === 'mail'
                    ? 'admin.system.channel.password'
                    : 'admin.system.channel.token'
                  ) | transloco
                "
                [hint]="
                  (secretSet()
                    ? 'admin.system.channel.secretKept'
                    : 'admin.system.channel.secretMissing'
                  ) | transloco
                "
              >
                <input
                  appControl
                  type="password"
                  autocomplete="new-password"
                  dir="ltr"
                  maxlength="255"
                  [value]="secret()"
                  (input)="secret.set($any($event.target).value)"
                />
              </app-field>
              @if (errorKey(); as key) {
                <p class="note note-warn m-0" role="alert">{{ key | transloco }}</p>
              }
              <button
                appButton
                type="submit"
                class="self-start"
                [busy]="busy()"
                [disabled]="busy()"
              >
                {{ 'common.save' | transloco }}
              </button>
            </form>
            <section class="card flex flex-col gap-4" aria-labelledby="test-title">
              <h2 class="t-h4 m-0 text-heading" id="test-title">
                {{ 'admin.system.channel.test' | transloco }}
              </h2>
              <app-field
                [label]="
                  (channel() === 'mail'
                    ? 'admin.system.channel.testTo'
                    : 'admin.system.channel.testPhone'
                  ) | transloco
                "
              >
                <input
                  appControl
                  dir="ltr"
                  [attr.type]="channel() === 'mail' ? 'email' : 'tel'"
                  [value]="testTo()"
                  (input)="testTo.set($any($event.target).value)"
                />
              </app-field>
              <button
                appButton
                variant="line"
                type="button"
                class="self-start"
                [disabled]="busy() || !testTo().trim()"
                (click)="test()"
              >
                <app-icon name="send" [size]="16" />{{
                  'admin.system.channel.sendTest' | transloco
                }}
              </button>
              @if (s.lastTestAt) {
                <p
                  class="note m-0"
                  [class.note-ok]="s.lastTestOk"
                  [class.note-warn]="!s.lastTestOk"
                  role="status"
                  data-testid="last-test"
                >
                  {{
                    (s.lastTestOk
                      ? 'admin.system.channel.lastTestOk'
                      : 'admin.system.channel.lastTestFailed'
                    ) | transloco: { time: (s.lastTestAt | localDate: 'datetime') }
                  }}
                  @if (!s.lastTestOk && s.lastTestError) {
                    <span class="block text-sm" dir="ltr">{{ s.lastTestError }}</span>
                  }
                </p>
              }
            </section>
          </div>
        } @else if (settings.error()) {
          <p class="note note-warn" role="alert">{{ 'admin.common.loadError' | transloco }}</p>
        } @else {
          <span class="skeleton block h-60" aria-hidden="true"></span>
        }
      }
      @case ('templates') {
        @if (templates.value(); as list) {
          <ul class="m-0 flex list-none flex-col gap-2 p-0" data-testid="template-rows">
            @for (tpl of list; track tpl.key) {
              <li
                class="card flex flex-wrap items-center gap-3 p-3 md:p-4"
                [attr.data-template]="tpl.key"
              >
                <div class="flex min-w-0 flex-1 basis-56 flex-col">
                  <strong class="text-heading">{{
                    locale.lang() === 'en' && tpl.nameEn ? tpl.nameEn : tpl.nameAr
                  }}</strong>
                  <code class="t-caption text-text-muted" dir="ltr">{{ tpl.key }}</code>
                </div>
                <span
                  class="pill"
                  [class.pill-ok]="tpl.isEnabled"
                  [class.pill-plain]="!tpl.isEnabled"
                  >{{
                    (tpl.isEnabled
                      ? 'admin.system.channel.enabled'
                      : 'admin.system.channel.disabled'
                    ) | transloco
                  }}</span
                >
                <button
                  appButton
                  variant="link"
                  size="sm"
                  type="button"
                  (click)="editTemplate(tpl)"
                >
                  {{ 'admin.content.editShort' | transloco
                  }}<span class="sr-only">: {{ tpl.key }}</span>
                </button>
              </li>
            }
          </ul>
        } @else if (templates.error()) {
          <p class="note note-warn" role="alert">{{ 'admin.common.loadError' | transloco }}</p>
        } @else {
          <span class="skeleton block h-60" aria-hidden="true"></span>
        }
      }
      @case ('log') {
        <div class="mb-4 flex flex-wrap items-end gap-3">
          <label class="flex min-w-44 flex-col gap-2">
            <span class="field-label">{{ 'admin.system.channel.status' | transloco }}</span>
            <select class="control" (change)="setFilter('status', $any($event.target).value)">
              <option value="" [selected]="!status()">{{ 'admin.content.all' | transloco }}</option>
              @for (st of statuses; track st) {
                <option [value]="st" [selected]="st === status()">
                  {{ 'admin.system.channel.logStatus.' + st | transloco }}
                </option>
              }
            </select>
          </label>
          <label class="flex min-w-56 flex-col gap-2">
            <span class="field-label">{{ 'admin.system.channel.template' | transloco }}</span>
            <select class="control" (change)="setFilter('template', $any($event.target).value)">
              <option value="" [selected]="!template()">
                {{ 'admin.content.all' | transloco }}
              </option>
              @for (tpl of templates.value() ?? []; track tpl.key) {
                <option [value]="tpl.key" [selected]="tpl.key === template()">{{ tpl.key }}</option>
              }
            </select>
          </label>
        </div>
        @if (log.value(); as res) {
          @if (res.data.length) {
            <ul class="m-0 flex list-none flex-col gap-2 p-0" data-testid="log-rows">
              @for (row of res.data; track row.id) {
                <li class="card flex flex-wrap items-center gap-3 p-3 md:p-4">
                  <div class="flex min-w-0 flex-1 basis-64 flex-col gap-1">
                    <span class="font-semibold text-heading" dir="auto">{{
                      row.subject ?? row.templateKey
                    }}</span>
                    <span class="t-small text-text-muted"
                      ><span dir="ltr">{{ row.toEmail ?? row.toPhone }}</span> ·
                      <code dir="ltr">{{ row.templateKey }}</code> ·
                      {{ row.createdAt | localDate: 'datetime' }}</span
                    >
                    @if (row.error) {
                      <span class="t-small text-alert-text" dir="ltr">{{ row.error }}</span>
                    }
                  </div>
                  <span
                    class="pill"
                    [class.pill-ok]="row.status === 'sent'"
                    [class.pill-warn]="row.status === 'failed'"
                    [class.pill-plain]="row.status === 'queued' || row.status === 'skipped'"
                    >{{ 'admin.system.channel.logStatus.' + row.status | transloco }}</span
                  >
                  @if (canRetry(row)) {
                    <button
                      appButton
                      variant="soft"
                      size="sm"
                      type="button"
                      [disabled]="busy()"
                      (click)="retry(row)"
                    >
                      <app-icon name="rotate-ccw" [size]="16" />{{
                        'admin.system.channel.retry' | transloco
                      }}
                    </button>
                  }
                </li>
              }
            </ul>
            <app-pagination [page]="page()" [total]="res.total" [pageSize]="logPage" />
          } @else {
            <p class="card t-muted m-0">{{ 'admin.system.channel.logEmpty' | transloco }}</p>
          }
        } @else if (log.error()) {
          <p class="note note-warn" role="alert">{{ 'admin.common.loadError' | transloco }}</p>
        } @else {
          <span class="skeleton block h-60" aria-hidden="true"></span>
        }
      }
    }
  `,
})
export class AdminChannel {
  /** Route data. */
  readonly channel = input.required<Channel>();
  /** Query params. */
  readonly tab = input<string | null>(null);
  readonly status = input<string | null>(null);
  readonly template = input<string | null>(null);
  readonly page = input(1, { transform: (v: unknown) => numberAttribute(v, 1) });

  private readonly api = inject(SystemApi);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  protected readonly locale = inject(LocaleService);
  protected readonly tabs = TABS;
  protected readonly statuses = STATUSES;
  protected readonly logPage = LOG_PAGE;
  protected readonly current = computed<Tab>(() =>
    TABS.includes(this.tab() as Tab) ? (this.tab() as Tab) : 'settings',
  );
  protected readonly fields = computed(() => CHANNEL_FIELDS[this.channel()]);

  protected readonly settings = rxResource({
    params: () => this.channel(),
    stream: ({ params }) => this.api.channelSettings<MailSettings | SmsSettings>(params),
  });
  protected readonly templates = rxResource({
    params: () => this.channel(),
    stream: ({ params }) => this.api.templates(params),
  });
  private readonly reloadLog = signal(0);
  protected readonly log = rxResource({
    params: () => ({
      channel: this.channel(),
      reload: this.reloadLog(),
      q: {
        page: this.page(),
        limit: LOG_PAGE,
        status: STATUSES.includes(this.status() as LogStatus) ? (this.status() as LogStatus) : null,
        template: this.template() || null,
      },
    }),
    stream: ({ params }) => this.api.log(params.channel, params.q),
  });

  protected readonly model = signal<Record<string, unknown>>({});
  protected readonly secret = signal('');
  protected readonly testTo = signal('');
  protected readonly busy = signal(false);
  protected readonly tried = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly server = signal<Record<string, string[]>>({});
  protected readonly secretSet = computed(() => {
    const s = this.settings.value();
    return !!s && ('passwordIsSet' in s ? s.passwordIsSet : (s as SmsSettings).tokenIsSet);
  });
  private readonly client = computed(() => validate(this.fields(), this.model()));
  protected readonly errors = computed<Record<string, FieldErrorLike[]>>(() => {
    const out = this.tried()
      ? toFieldErrors(this.client(), this.fields(), (k) => this.t.translate(k))
      : {};
    for (const [key, messages] of Object.entries(this.server())) {
      out[key] = [...(out[key] ?? []), ...messages.map((message) => ({ kind: 'server', message }))];
    }
    return out;
  });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
    effect(() => {
      const s = this.settings.value();
      if (s) untracked(() => this.model.set(modelFromRow(this.fields(), s as never)));
    });
  }

  /** Log filters live in the URL, so a filtered view can be shared and survives a reload. */
  protected setFilter(key: 'status' | 'template', value: string): void {
    void this.router.navigate([], {
      queryParams: { [key]: value || null, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected canRetry(row: MessageLog): boolean {
    return this.channel() === 'mail' && row.status !== 'sent' && !!row.hasPayload;
  }

  protected async saveSettings(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    this.errorKey.set(null);
    this.server.set({});
    if (Object.keys(this.client()).length) return;
    const body = toBody(this.fields(), this.model(), 'update');
    // The password/token is write-only: send it only when typed (empty keeps the stored one).
    if (this.secret()) body[this.channel() === 'mail' ? 'password' : 'token'] = this.secret();
    this.busy.set(true);
    try {
      const saved = await firstValueFrom(
        this.api.saveChannelSettings<MailSettings | SmsSettings>(this.channel(), body),
      );
      this.settings.set(saved);
      this.secret.set('');
      this.tried.set(false);
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.saved') });
    } catch (error) {
      const problem = toApiProblem(error);
      this.server.set(problem.fieldErrors);
      this.errorKey.set(problemMessageKey(problem));
    } finally {
      this.busy.set(false);
    }
  }

  protected async test(): Promise<void> {
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.api.testChannel(this.channel(), this.testTo().trim()));
      this.toasts.show({
        kind: res.ok ? 'success' : 'error',
        message: res.ok
          ? this.t.translate('admin.system.channel.testSent')
          : (res.error ?? this.t.translate('errors.generic')),
      });
      this.settings.reload();
    } catch (error) {
      this.toasts.show({
        kind: 'error',
        message: this.t.translate(problemMessageKey(toApiProblem(error))),
      });
    } finally {
      this.busy.set(false);
    }
  }

  protected async editTemplate(template: MessageTemplate): Promise<void> {
    const ref = this.dialogs.open<MessageTemplate>(TemplateEditor, {
      data: { channel: this.channel(), template },
      ariaLabelledBy: 'template-title',
      width: 'min(900px, calc(100vw - 32px))',
      disableClose: true,
    });
    const saved = await firstValueFrom(ref.closed);
    if (saved) {
      this.templates.update((list) => (list ?? []).map((x) => (x.key === saved.key ? saved : x)));
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.saved') });
    }
  }

  protected async retry(row: MessageLog): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.retryMail(row.id));
      this.reloadLog.update((n) => n + 1);
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
