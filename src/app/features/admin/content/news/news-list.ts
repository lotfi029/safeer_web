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
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, map } from 'rxjs';
import {
  ContentApi,
  type ContentQuery,
  type ContentRow,
  mediaUrl,
} from '../../../../core/api/admin/content-api';
import { problemMessageKey, toApiProblem } from '../../../../core/api/problem';
import { LocaleService } from '../../../../core/i18n/locale.service';
import { SeoService } from '../../../../core/seo/seo.service';
import { DigitsPipe, LocalDatePipe } from '../../../../shared/pipes/format';
import { Button } from '../../../../shared/ui/button/button';
import { DialogService } from '../../../../shared/ui/dialog/dialog';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { ToastService } from '../../../../shared/ui/toast/toast';
import { AdminPageHead } from '../../layout/admin-page-head';
import { confirmAction } from '../../shared/confirm-dialog';
import { pick } from '../crud/crud-config';
import { MediaStore } from '../media/media-store';

export type NewsFilter = 'published' | 'draft' | 'legacy';
const FILTERS: readonly NewsFilter[] = ['published', 'draft', 'legacy'];
const PAGE_SIZE = 20;

/** `?filter=` → the admin list query (booleans as 1/0: the API compares column filters as strings). */
export function newsQuery(filter: string | null, q: string | null, page: number): ContentQuery {
  const query: ContentQuery = { page: Math.max(1, page), limit: PAGE_SIZE, q: q?.trim() || null };
  if (filter === 'published') query.published = true;
  if (filter === 'draft') query.published = false;
  if (filter === 'legacy') query['isLegacy'] = 1;
  return query;
}

/**
 * News (prototype `aNews`): filters (all/published/draft/legacy) and search in the URL, the
 * legacy-template banner with one "delete all" (`DELETE admin/news/legacy`), and a row per story
 * with cover, category, date and status.
 */
@Component({
  selector: 'app-admin-news-list',
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
      [heading]="'admin.content.news.title' | transloco"
      [sub]="
        list.value()
          ? ('admin.content.news.total' | transloco: { count: (list.value()!.total | digits) })
          : null
      "
    >
      <a
        pageActions
        appButton
        variant="line"
        size="sm"
        [routerLink]="locale.link('/admin/news/categories')"
      >
        {{ 'admin.content.newsCategories.title' | transloco }}
      </a>
      <a pageActions appButton size="sm" [routerLink]="locale.link('/admin/news/new')">
        <app-icon name="plus" [size]="18" />{{ 'admin.content.news.new' | transloco }}
      </a>
    </app-admin-page-head>

    <div class="flex flex-col gap-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <nav
          class="flex flex-wrap gap-2"
          [attr.aria-label]="'admin.content.news.filters' | transloco"
        >
          <a
            class="chip"
            [routerLink]="[]"
            [queryParams]="{ filter: null, page: null }"
            queryParamsHandling="merge"
            [attr.aria-current]="!current() ? 'page' : null"
            >{{ 'admin.content.all' | transloco }}</a
          >
          @for (f of filters; track f) {
            <a
              class="chip"
              [routerLink]="[]"
              [queryParams]="{ filter: f, page: null }"
              queryParamsHandling="merge"
              [attr.aria-current]="current() === f ? 'page' : null"
            >
              {{ 'admin.content.news.filter.' + f | transloco }}
              @if (f === 'legacy' && legacyCount()) {
                {{ legacyCount() | digits }}
              }
            </a>
          }
        </nav>
        <label class="relative block sm:ms-auto sm:w-72">
          <span class="sr-only">{{ 'admin.content.news.search' | transloco }}</span>
          <app-icon
            name="search"
            class="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-decor"
          />
          <input
            type="search"
            class="control ps-12"
            [placeholder]="'admin.content.news.search' | transloco"
            [value]="q() ?? ''"
            (input)="onSearch($any($event.target).value)"
          />
        </label>
      </div>

      @if (legacyCount()) {
        <div
          class="note note-warn flex flex-wrap items-center gap-3"
          role="region"
          [attr.aria-label]="'admin.content.news.legacyTitle' | transloco"
        >
          <app-icon name="triangle-alert" />
          <p class="m-0 flex-1">
            {{ 'admin.content.news.legacyNote' | transloco: { count: (legacyCount() | digits) } }}
          </p>
          <button
            appButton
            variant="danger"
            size="sm"
            type="button"
            [disabled]="busy()"
            (click)="deleteLegacy()"
          >
            {{ 'admin.content.news.deleteLegacy' | transloco }}
          </button>
        </div>
      }

      @if (list.error()) {
        <p class="note note-warn" role="alert">{{ 'admin.common.loadError' | transloco }}</p>
      } @else if (list.value(); as res) {
        @if (res.data.length) {
          <ul class="m-0 flex list-none flex-col gap-2 p-0" data-testid="news-rows">
            @for (p of res.data; track p.id) {
              <li class="card flex flex-wrap items-center gap-4 p-3 md:p-4" [attr.data-row]="p.id">
                @if (cover(p); as src) {
                  <img
                    [src]="src"
                    alt=""
                    class="h-14 w-20 shrink-0 rounded-btn bg-raise object-cover"
                    loading="lazy"
                  />
                } @else {
                  <span
                    class="grid h-14 w-20 shrink-0 place-items-center rounded-btn bg-raise text-decor"
                    aria-hidden="true"
                  >
                    <app-icon name="image" [size]="20" />
                  </span>
                }
                <div class="flex min-w-0 flex-1 basis-56 flex-col gap-1">
                  <a
                    class="line-clamp-2 font-semibold text-heading"
                    dir="auto"
                    [routerLink]="locale.link('/admin/news/' + p.id)"
                    >{{ title(p) }}</a
                  >
                  <span class="t-small text-text-muted">
                    {{ categoryName(p) }} ·
                    {{
                      p['publishedOn']
                        ? ($any(p['publishedOn']) | localDate: 'medium')
                        : ('admin.content.news.noDate' | transloco)
                    }}
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  @if (p['isLegacy'] === true) {
                    <span class="pill pill-warn">{{
                      'admin.content.news.filter.legacy' | transloco
                    }}</span>
                  }
                  @if (p['isFeatured'] === true) {
                    <span class="pill">{{ 'admin.content.fields.isFeatured' | transloco }}</span>
                  }
                  <span
                    class="pill"
                    [class.pill-ok]="p['isPublished'] === true"
                    [class.pill-plain]="p['isPublished'] !== true"
                    >{{
                      (p['isPublished'] === true
                        ? 'admin.content.news.filter.published'
                        : 'admin.content.news.filter.draft'
                      ) | transloco
                    }}</span
                  >
                  <a
                    appButton
                    variant="link"
                    size="sm"
                    [routerLink]="locale.link('/admin/news/' + p.id)"
                  >
                    {{ 'admin.content.editShort' | transloco
                    }}<span class="sr-only">: {{ title(p) }}</span>
                  </a>
                </div>
              </li>
            }
          </ul>
          <app-pagination [page]="page()" [total]="res.total" [pageSize]="pageSize" />
        } @else {
          <p class="card t-muted m-0">{{ 'admin.content.empty' | transloco }}</p>
        }
      } @else {
        <span class="skeleton block h-40" aria-hidden="true"></span>
      }
    </div>
  `,
})
export class AdminNewsList {
  readonly filter = input<string | null>(null);
  readonly q = input<string | null>(null);
  readonly page = input(1, { transform: (v: unknown) => numberAttribute(v, 1) });

  private readonly api = inject(ContentApi);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly media = inject(MediaStore);
  protected readonly locale = inject(LocaleService);
  protected readonly filters = FILTERS;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly busy = signal(false);
  private readonly reload = signal(0);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly current = computed(() =>
    FILTERS.includes(this.filter() as NewsFilter) ? (this.filter() as NewsFilter) : null,
  );
  protected readonly list = rxResource({
    params: () => ({
      query: newsQuery(this.current(), this.q(), this.page()),
      reload: this.reload(),
    }),
    stream: ({ params }) => this.api.list('news', params.query),
  });
  private readonly legacy = rxResource({
    params: () => this.reload(),
    stream: () => this.api.list('news', { isLegacy: 1, limit: 1 }).pipe(map((r) => r.total)),
  });
  protected readonly legacyCount = computed(() => this.legacy.value() ?? 0);
  private readonly categories = rxResource({
    stream: () => this.api.list('news-categories', { limit: 100 }),
  });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
    void this.media.ensure().catch(() => undefined);
  }

  protected title(p: ContentRow): string {
    return pick(p, 'title', this.locale.lang()) || `#${p.id}`;
  }

  protected categoryName(p: ContentRow): string {
    const cat = this.categories.value()?.data.find((c) => c.id === p['categoryId']);
    return cat ? pick(cat, 'name', this.locale.lang()) : '—';
  }

  protected cover(p: ContentRow): string | null {
    const a = this.media.get(p['coverAssetId'] as string | null);
    return a?.kind === 'image' ? mediaUrl(a, 'thumb') : null;
  }

  protected onSearch(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(
      () =>
        void this.router.navigate([], {
          queryParams: { q: value.trim() || null, page: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      300,
    );
  }

  protected async deleteLegacy(): Promise<void> {
    const ok = await confirmAction(this.dialogs, {
      heading: this.t.translate('admin.content.news.deleteLegacy'),
      body: this.t.translate('admin.content.news.deleteLegacyConfirm', {
        count: this.legacyCount(),
      }),
      confirm: this.t.translate('admin.common.delete'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      const { deleted } = await firstValueFrom(this.api.deleteLegacyNews());
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.content.news.legacyDeleted', { count: deleted }),
      });
      this.reload.update((n) => n + 1);
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
