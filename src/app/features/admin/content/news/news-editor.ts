import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import {
  ContentApi,
  type ContentRow,
  type WithWarnings,
} from '../../../../core/api/admin/content-api';
import { problemMessageKey, toApiProblem } from '../../../../core/api/problem';
import { LocaleService } from '../../../../core/i18n/locale.service';
import { SeoService } from '../../../../core/seo/seo.service';
import { Button } from '../../../../shared/ui/button/button';
import { DialogService } from '../../../../shared/ui/dialog/dialog';
import type { FieldErrorLike } from '../../../../shared/ui/field/field';
import { Icon } from '../../../../shared/ui/icon/icon';
import { ToastService } from '../../../../shared/ui/toast/toast';
import { AdminPageHead } from '../../layout/admin-page-head';
import { confirmAction } from '../../shared/confirm-dialog';
import { COLLECTIONS } from '../crud/collections';
import { emptyModel, modelFromRow, pick, toBody, validate } from '../crud/crud-config';
import { CrudFields, toFieldErrors } from '../crud/crud-fields';

/** safeer_api `RESERVED_POST_SLUGS` (common/validation/slug.ts: 12 words at rc1). */
export const RESERVED_POST_SLUGS = new Set([
  'featured',
  'new',
  'edit',
  'preview',
  'admin',
  'api',
  'sitemap',
  'search',
  'feed',
  'rss',
  'categories',
  'category',
]);
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugProblem(slug: string): 'required' | 'slug' | 'reserved' | null {
  if (!slug) return 'required';
  if (slug.length > 180 || !SLUG_RE.test(slug)) return 'slug';
  if (RESERVED_POST_SLUGS.has(slug)) return 'reserved';
  return null;
}

/**
 * A news story (create or edit): bilingual title/excerpt/Markdown body with preview, category, date,
 * cover (alt text required), featured/legacy flags, and, once saved, its slug. Publishing without a
 * cover succeeds with a `COVER_MISSING` warning, shown as a notice. "Preview" opens the public article
 * with a 15-minute preview token, so drafts can be checked as visitors will see them.
 */
@Component({
  selector: 'app-news-editor',
  imports: [RouterLink, TranslocoPipe, Button, Icon, AdminPageHead, CrudFields],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <a
      class="mb-3 inline-flex items-center gap-1 font-semibold text-secondary-text"
      [routerLink]="locale.link('/admin/news')"
    >
      <app-icon name="arrow-left" [size]="18" />{{ 'admin.content.news.back' | transloco }}
    </a>
    @if (loadError(); as key) {
      <p class="note note-warn" role="alert">{{ key | transloco }}</p>
    } @else if (ready()) {
      <app-admin-page-head
        [heading]="
          post()
            ? ('admin.content.news.editing' | transloco)
            : ('admin.content.news.new' | transloco)
        "
        [sub]="post() ? '/news/' + post()!['slug'] : null"
      >
        <span pageBefore>
          <span
            class="pill"
            [class.pill-ok]="published()"
            [class.pill-plain]="!published()"
            data-testid="news-status"
            >{{
              (published()
                ? 'admin.content.news.filter.published'
                : 'admin.content.news.filter.draft'
              ) | transloco
            }}</span
          >
        </span>
        @if (post()) {
          <button
            pageActions
            appButton
            variant="line"
            size="sm"
            type="button"
            [disabled]="busy()"
            (click)="preview()"
          >
            <app-icon name="eye" [size]="16" />{{ 'admin.content.news.preview' | transloco }}
          </button>
        }
      </app-admin-page-head>

      @if (coverMissing()) {
        <p
          class="note note-warn mb-5 flex items-start gap-2"
          role="status"
          data-testid="cover-missing"
        >
          <app-icon name="triangle-alert" class="shrink-0" />{{
            'admin.content.news.coverMissing' | transloco
          }}
        </p>
      }

      <form
        class="card flex flex-col gap-6"
        novalidate
        (submit)="save($event, null)"
        id="news-form"
      >
        <app-crud-fields [fields]="fields" [(model)]="model" [errors]="errors()" />
        @if (post()) {
          <div class="flex flex-col gap-2 border-t border-border pt-5">
            <label class="field-label" for="news-slug">{{
              'admin.content.fields.slug' | transloco
            }}</label>
            <input
              id="news-slug"
              class="control"
              dir="ltr"
              maxlength="180"
              [attr.aria-invalid]="slugErrors().length ? 'true' : null"
              [attr.aria-describedby]="
                'news-slug-hint' + (slugErrors().length ? ' news-slug-error' : '')
              "
              [value]="slug()"
              (input)="slug.set($any($event.target).value.trim())"
            />
            <p class="field-hint m-0" id="news-slug-hint">
              {{ 'admin.content.news.slugHint' | transloco }}
            </p>
            @if (slugErrors().length) {
              <p class="field-error m-0" id="news-slug-error" role="alert">
                @for (e of slugErrors(); track $index) {
                  <span class="block">{{ e.message || ('validation.' + e.kind | transloco) }}</span>
                }
              </p>
            }
          </div>
        }
        @if (errorKey(); as key) {
          <p class="note note-warn m-0" role="alert">{{ key | transloco }}</p>
        }
        <div
          class="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center gap-3 rounded-b-card border-t border-border bg-card px-5 py-4 md:static md:m-0 md:border-0 md:p-0"
        >
          <button appButton type="submit" [busy]="busy()" [disabled]="busy()">
            {{ 'common.save' | transloco }}
          </button>
          @if (published()) {
            <button
              appButton
              variant="line"
              type="button"
              [disabled]="busy()"
              (click)="save($event, false)"
            >
              {{ 'admin.content.news.unpublish' | transloco }}
            </button>
          } @else {
            <button
              appButton
              variant="soft"
              type="button"
              [disabled]="busy()"
              (click)="save($event, true)"
            >
              {{ 'admin.content.news.publish' | transloco }}
            </button>
          }
          <span class="grow"></span>
          @if (post()) {
            <button appButton variant="danger" type="button" [disabled]="busy()" (click)="remove()">
              <app-icon name="trash-2" [size]="16" />{{ 'admin.common.delete' | transloco }}
            </button>
          }
        </div>
      </form>
    } @else {
      <span class="skeleton block h-80" aria-hidden="true"></span>
    }
  `,
})
export class NewsEditor {
  /** Route param; absent on `news/new`. */
  readonly id = input<string | undefined>();

  private readonly api = inject(ContentApi);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly doc = inject(DOCUMENT);
  protected readonly locale = inject(LocaleService);

  protected readonly fields = COLLECTIONS['news'].fields;
  protected readonly post = signal<ContentRow | null>(null);
  protected readonly ready = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly model = signal<Record<string, unknown>>(emptyModel(this.fields));
  protected readonly slug = signal('');
  protected readonly busy = signal(false);
  protected readonly tried = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly warnings = signal<string[]>([]);
  private readonly server = signal<Record<string, string[]>>({});

  protected readonly published = computed(() => this.post()?.['isPublished'] === true);
  protected readonly coverMissing = computed(() => this.warnings().includes('COVER_MISSING'));
  private readonly client = computed(() => validate(this.fields, this.model()));
  protected readonly errors = computed<Record<string, FieldErrorLike[]>>(() => {
    const out = this.tried()
      ? toFieldErrors(this.client(), this.fields, (k) => this.t.translate(k))
      : {};
    for (const [key, messages] of Object.entries(this.server())) {
      if (key === 'slug') continue;
      out[key] = [...(out[key] ?? []), ...messages.map((message) => ({ kind: 'server', message }))];
    }
    return out;
  });
  protected readonly slugErrors = computed<FieldErrorLike[]>(() => {
    const own = this.post() && this.tried() ? slugProblem(this.slug()) : null;
    const out: FieldErrorLike[] = own
      ? toFieldErrors(
          { slug: [own] },
          [{ key: 'slug', type: 'slug', label: 'slug', max: 180 }],
          (k) => this.t.translate(k),
        )['slug']
      : [];
    return [
      ...out,
      ...(this.server()['slug'] ?? []).map((message) => ({ kind: 'server', message })),
    ];
  });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string | undefined): Promise<void> {
    this.ready.set(false);
    this.loadError.set(null);
    this.warnings.set([]);
    if (!id) {
      this.post.set(null);
      this.model.set(emptyModel(this.fields));
      this.ready.set(true);
      return;
    }
    try {
      const row = await firstValueFrom(this.api.get('news', id));
      this.adopt(row);
      this.ready.set(true);
    } catch (error) {
      this.loadError.set(problemMessageKey(toApiProblem(error)));
    }
  }

  private adopt(row: WithWarnings<ContentRow>): void {
    this.post.set(row);
    this.model.set(modelFromRow(this.fields, row));
    this.slug.set(String(row['slug'] ?? ''));
    if (row.warnings) this.warnings.set(row.warnings);
  }

  /** Save; `publish` true/false also (un)publishes in the same request. */
  protected async save(event: Event, publish: boolean | null): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    this.errorKey.set(null);
    this.server.set({});
    const current = this.post();
    if (Object.keys(this.client()).length || (current && slugProblem(this.slug()))) return;
    const body: Record<string, unknown> = toBody(
      this.fields,
      this.model(),
      current ? 'update' : 'create',
    );
    if (publish !== null) body['isPublished'] = publish;
    if (current && this.slug() !== current['slug']) body['slug'] = this.slug();
    this.busy.set(true);
    try {
      const saved = current
        ? await firstValueFrom(this.api.update('news', current.id, body))
        : await firstValueFrom(this.api.create('news', body));
      this.adopt(saved);
      this.warnings.set(saved.warnings ?? []);
      this.toasts.show({
        kind: 'success',
        message: this.t.translate(
          publish === true
            ? 'admin.content.news.publishedToast'
            : publish === false
              ? 'admin.content.news.unpublishedToast'
              : 'admin.content.saved',
        ),
      });
      if (!current) {
        await this.router.navigateByUrl(this.locale.link(`/admin/news/${saved.id}`), {
          replaceUrl: true,
        });
      }
    } catch (error) {
      const problem = toApiProblem(error);
      const fieldErrors = { ...problem.fieldErrors };
      if (problem.code === 'SLUG_TAKEN')
        fieldErrors['slug'] = [this.t.translate('errors.codes.SLUG_TAKEN')];
      this.server.set(fieldErrors);
      this.errorKey.set(problemMessageKey(problem));
    } finally {
      this.busy.set(false);
    }
  }

  protected async preview(): Promise<void> {
    const p = this.post();
    if (!p) return;
    // Open the tab synchronously (popup blockers), then point it at the tokenised URL.
    const tab = this.doc.defaultView?.open('', '_blank');
    try {
      const { token } = await firstValueFrom(this.api.previewToken(p.id));
      const url = `${this.locale.link(`/news/${String(p['slug'])}`)}?preview=${encodeURIComponent(token)}`;
      if (tab) tab.location.href = url;
      else this.doc.defaultView?.open(url, '_blank');
    } catch (error) {
      tab?.close();
      this.toasts.show({
        kind: 'error',
        message: this.t.translate(problemMessageKey(toApiProblem(error))),
      });
    }
  }

  protected async remove(): Promise<void> {
    const p = this.post();
    if (!p) return;
    const ok = await confirmAction(this.dialogs, {
      heading: this.t.translate('admin.common.confirmDelete'),
      body: this.t.translate('admin.content.deleteConfirm', {
        title: pick(p, 'title', this.locale.lang()),
      }),
      confirm: this.t.translate('admin.common.delete'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.remove('news', p.id));
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.deleted') });
      await this.router.navigateByUrl(this.locale.link('/admin/news'));
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
