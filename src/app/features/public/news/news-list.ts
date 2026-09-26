import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { LocalDatePipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { FilterBar, type FilterChip } from '../../../shared/ui/filter-bar/filter-bar';
import { Icon } from '../../../shared/ui/icon/icon';
import { Image } from '../../../shared/ui/image/image';
import { PageHead } from '../../../shared/ui/page-head/page-head';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { pageSeo } from '../page-meta';
import { NewsCard } from './news-card';
import { NewsletterForm } from './newsletter-form';
import type { NewsListData } from './news.resolvers';

export {
  NEWS_PAGE_SIZE,
  newsFilters,
  newsListResolver,
  type NewsFilters,
  type NewsListData,
} from './news.resolvers';

/**
 * News list (prototype `#/news`): category chips (real links) + debounced search that updates the
 * URL, featured story on the unfiltered first page, card grid, crawlable pagination, newsletter band.
 */
@Component({
  selector: 'app-news-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    LocalDatePipe,
    PageState,
    PageHead,
    FilterBar,
    Pagination,
    EmptyState,
    Button,
    Icon,
    Image,
    Reveal,
    NewsCard,
    NewsletterForm,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().failure; as failure) {
      <app-page-state [failure]="failure" />
    } @else if (data().data; as d) {
      <app-page-head
        [title]="d.page.title"
        [lead]="d.page.metaDescription"
        [breadcrumb]="breadcrumb()"
      />

      <section class="py-12 md:py-16" aria-labelledby="news-list-title">
        <div class="wrap flex flex-col gap-8">
          <h2 id="news-list-title" class="sr-only">
            {{
              d.filters.q ? ('pages.news.resultsFor' | transloco: { q: d.filters.q }) : d.page.title
            }}
          </h2>
          <app-filter-bar
            [linkMode]="true"
            queryParamName="category"
            [chips]="chips()"
            [selected]="d.filters.category"
            [searchValue]="d.filters.q ?? ''"
            [label]="'pages.news.categories' | transloco"
            [searchLabel]="'pages.news.searchPlaceholder' | transloco"
            [placeholder]="'pages.news.searchPlaceholder' | transloco"
            (searchChange)="search($event)"
          />

          @if (d.featured; as f) {
            <article
              appReveal
              class="card grid gap-6 !p-4 md:!p-6 lg:grid-cols-2 lg:items-center"
              aria-labelledby="news-featured-title"
            >
              <app-image
                class="overflow-hidden rounded-2xl"
                imgClass="block w-full h-auto aspect-video object-cover"
                [asset]="f.coverAsset"
                [placeholder]="f.category?.name ?? ('pages.news.image' | transloco)"
                [aspect]="[16, 9]"
                sizes="(min-width: 1024px) 600px, 100vw"
                [priority]="true"
              />
              <div class="flex flex-col items-start gap-4 lg:px-4">
                <div class="flex flex-wrap items-center gap-3">
                  <span class="pill pill-solid">{{ 'pages.news.featured' | transloco }}</span>
                  @if (f.category; as c) {
                    <span class="pill">{{ c.name }}</span>
                  }
                  @if (f.publishedOn; as date) {
                    <time class="t-caption" [attr.datetime]="date">{{ date | localDate }}</time>
                  }
                </div>
                <h3 id="news-featured-title" class="t-h3">{{ f.title }}</h3>
                @if (f.excerpt; as x) {
                  <p class="t-muted leading-[1.9]">{{ x }}</p>
                }
                <a appButton variant="link" [routerLink]="locale.link('/news/' + f.slug)">
                  {{ 'pages.news.readFull' | transloco }}
                  <app-icon name="arrow-right" [size]="18" />
                </a>
              </div>
            </article>
          }

          @if (grid().length) {
            <ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
              @for (post of grid(); track post.id; let i = $index) {
                <li appReveal [revealIndex]="i" class="flex">
                  <app-news-card class="w-full" [post]="post" />
                </li>
              }
            </ul>
          } @else if (!d.featured) {
            <app-empty-state
              icon="newspaper"
              [title]="'pages.news.emptyTitle' | transloco"
              [body]="'pages.news.emptyBody' | transloco"
            >
              <a appButton variant="line" size="sm" [routerLink]="locale.link('/news')">{{
                'pages.news.clearFilters' | transloco
              }}</a>
            </app-empty-state>
          }

          <app-pagination
            [page]="d.list.page"
            [total]="d.list.total"
            [pageSize]="d.list.limit"
            [label]="'pages.news.pagination' | transloco"
          />
        </div>
      </section>

      <!-- Client-rendered on viewport (no SSR hydration): text typed into a server-rendered
           field would be reset when a deferred block hydrates. -->
      @defer (on viewport) {
        <app-newsletter-form />
      } @placeholder {
        <div class="min-h-60 bg-surface"></div>
      }
    }
  `,
})
export class NewsListPage {
  readonly data = input.required<Loaded<NewsListData>>();

  protected readonly locale = inject(LocaleService);
  private readonly router = inject(Router);
  private readonly t = inject(TranslocoService);
  private readonly seo = pageSeo();

  protected readonly chips = computed<FilterChip[]>(() => [
    { value: null, label: this.t.translate('pages.news.all') },
    ...(this.data().data?.categories ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ value: c.slug, label: c.name })),
  ]);
  /** The featured story heads the unfiltered first page; don't repeat it in the grid. */
  protected readonly grid = computed(() => {
    const d = this.data().data;
    return (d?.list.data ?? []).filter((p) => p.id !== d?.featured?.id);
  });
  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    { label: this.data().data?.page.title ?? '' },
  ]);

  constructor() {
    effect(() => {
      const d = this.data().data;
      const f = d?.filters;
      // Canonical: the category/page listing; search results are not indexed.
      const query = new URLSearchParams();
      if (f?.category) query.set('category', f.category);
      if (f && f.page > 1) query.set('page', String(f.page));
      const qs = query.toString();
      this.seo({ page: d?.page, path: `/news${qs ? `?${qs}` : ''}`, noindex: !!f?.q });
    });
  }

  protected search(value: string): void {
    const q = value.trim();
    void this.router.navigate([], {
      queryParams: { q: q || null, page: null },
      queryParamsHandling: 'merge',
    });
  }
}
