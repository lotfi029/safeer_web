import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { fileUrl } from '../../../core/api/public-api';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SITE_ORIGIN } from '../../../core/config/site-origin';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/site/site.store';
import { LocalDatePipe, toArabicDigits } from '../../../shared/pipes/format';
import { Breadcrumb, type BreadcrumbItem } from '../../../shared/ui/page-head/breadcrumb';
import { Button, IconButton } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { Image } from '../../../shared/ui/image/image';
import { RichText } from '../../../shared/ui/rich-text/rich-text';
import { ToastService } from '../../../shared/ui/toast/toast';
import type { ArticleData } from './news.resolvers';

export { articleResolver, type ArticleData } from './news.resolvers';

/**
 * News article (prototype `#/article`): breadcrumb, category/date/reading time, title, cover, the
 * API's sanitized HTML body through `<app-rich-text>` (the only innerHTML), share row (Web Share
 * when available, copy link, X, email), aside with the apply CTA, related stories and categories.
 * JSON-LD NewsArticle + BreadcrumbList; `noindex` in preview.
 */
@Component({
  selector: 'app-article-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    LocalDatePipe,
    PageState,
    Breadcrumb,
    Button,
    IconButton,
    Icon,
    Image,
    RichText,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().failure; as failure) {
      <app-page-state [failure]="failure" />
    } @else if (data().data; as d) {
      <div class="wrap grid gap-10 py-10 md:py-16 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-12">
        <article class="flex min-w-0 flex-col gap-6" aria-labelledby="article-title">
          <app-breadcrumb [items]="breadcrumb()" />
          @if (d.preview) {
            <p class="note note-warn" role="status">{{ 'pages.news.preview' | transloco }}</p>
          }
          <div class="flex flex-wrap items-center gap-3">
            @if (d.post.category; as c) {
              <a
                class="pill no-underline"
                [routerLink]="locale.link('/news')"
                [queryParams]="{ category: c.slug }"
                >{{ c.name }}</a
              >
            }
            @if (d.post.publishedOn; as date) {
              <time class="t-caption" [attr.datetime]="date">{{ date | localDate }}</time>
              <span class="t-caption" aria-hidden="true">·</span>
            }
            <span class="t-caption">{{ readTime() }}</span>
          </div>
          <h1 id="article-title" class="t-h1 text-balance">{{ d.post.title }}</h1>
          <app-image
            class="overflow-hidden rounded-[20px]"
            imgClass="block w-full h-auto aspect-video object-cover"
            [asset]="d.post.coverAsset"
            [placeholder]="'pages.news.coverImage' | transloco"
            [aspect]="[16, 9]"
            sizes="(min-width: 1280px) 820px, (min-width: 1024px) 60vw, 100vw"
            [priority]="true"
          />
          @if (d.post.excerpt; as x) {
            <p class="text-[19px] leading-[1.9] text-heading">{{ x }}</p>
          }
          <app-rich-text class="t-body" [html]="d.post.body" />

          <div class="flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <span class="font-semibold text-heading">{{ 'pages.news.share' | transloco }}</span>
            @if (canShare()) {
              <button
                [appIconButton]="'pages.news.shareNative' | transloco"
                type="button"
                (click)="shareNative()"
              >
                <app-icon name="share-2" />
              </button>
            }
            <button
              [appIconButton]="'pages.news.copyLink' | transloco"
              type="button"
              (click)="copyLink()"
            >
              <app-icon name="link" />
            </button>
            <a
              [appIconButton]="'pages.news.shareX' | transloco"
              [href]="xHref()"
              target="_blank"
              rel="noopener noreferrer"
            >
              <app-icon name="x" />
            </a>
            <a [appIconButton]="'pages.news.shareMail' | transloco" [href]="mailHref()">
              <app-icon name="mail" />
            </a>
          </div>
        </article>

        <aside class="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
          <div class="card band border-0">
            <h2 class="t-h4">{{ 'pages.news.ctaTitle' | transloco }}</h2>
            <p class="mt-3 mb-5 text-band-soft">{{ 'pages.news.ctaBody' | transloco }}</p>
            <a appButton variant="onband" [block]="true" [routerLink]="locale.link('/apply')">{{
              'pages.news.ctaButton' | transloco
            }}</a>
          </div>

          @if (d.post.related.length) {
            @defer (on viewport; hydrate on viewport) {
              <section class="card flex flex-col gap-4" aria-labelledby="article-related">
                <h2 id="article-related" class="t-h4">{{ 'pages.news.related' | transloco }}</h2>
                <ul class="m-0 flex list-none flex-col gap-4 p-0">
                  @for (r of d.post.related; track r.id) {
                    <li class="relative flex items-center gap-4">
                      <app-image
                        class="size-18 shrink-0 overflow-hidden rounded-[14px]"
                        imgClass="size-18 object-cover"
                        [asset]="r.coverAsset"
                        [placeholder]="'pages.news.image' | transloco"
                        [aspect]="[1, 1]"
                        sizes="72px"
                      />
                      <div class="flex min-w-0 flex-col gap-1">
                        <a
                          class="font-semibold text-heading no-underline after:absolute after:inset-0 after:content-[''] hover:text-secondary"
                          [routerLink]="locale.link('/news/' + r.slug)"
                          >{{ r.title }}</a
                        >
                        @if (r.publishedOn; as date) {
                          <time class="t-caption" [attr.datetime]="date">{{
                            date | localDate
                          }}</time>
                        }
                      </div>
                    </li>
                  }
                </ul>
              </section>
            } @placeholder {
              <div class="card min-h-60"></div>
            }
          }

          @if (d.categories.length) {
            <nav class="card flex flex-col gap-4" aria-labelledby="article-categories">
              <h2 id="article-categories" class="t-h4">
                {{ 'pages.news.categories' | transloco }}
              </h2>
              <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
                @for (c of d.categories; track c.id) {
                  <li>
                    <a
                      class="chip"
                      [routerLink]="locale.link('/news')"
                      [queryParams]="{ category: c.slug }"
                      >{{ c.name }}</a
                    >
                  </li>
                }
              </ul>
            </nav>
          }
        </aside>
      </div>
    }
  `,
})
export class ArticlePage {
  readonly data = input.required<Loaded<ArticleData>>();

  protected readonly locale = inject(LocaleService);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  private readonly t = inject(TranslocoService);
  private readonly toast = inject(ToastService);
  private readonly origin = inject(SITE_ORIGIN);

  protected readonly canShare = signal(false);

  private readonly path = computed(() => `/news/${this.data().data?.post.slug ?? ''}`);
  protected readonly url = computed(() => this.seo.url(this.locale.lang(), this.path()));
  protected readonly readTime = computed(() => {
    const n = this.data().data?.post.readMinutes ?? 1;
    return n <= 1
      ? this.t.translate('pages.news.readMinute')
      : this.t.translate('pages.news.readMinutes', {
          n: this.locale.lang() === 'ar' ? toArabicDigits(String(n)) : n,
        });
  });
  protected readonly xHref = computed(
    () =>
      `https://x.com/intent/post?url=${encodeURIComponent(this.url())}&text=${encodeURIComponent(this.data().data?.post.title ?? '')}`,
  );
  protected readonly mailHref = computed(
    () =>
      `mailto:?subject=${encodeURIComponent(this.data().data?.post.title ?? '')}&body=${encodeURIComponent(this.url())}`,
  );
  protected readonly breadcrumb = computed(() => {
    const post = this.data().data?.post;
    const items: BreadcrumbItem[] = [
      { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
      { label: this.t.translate('shell.footer.news'), link: this.locale.link('/news') },
    ];
    if (post?.category) {
      items.push({ label: post.category.name });
    }
    return items;
  });

  constructor() {
    afterNextRender(() => this.canShare.set(typeof navigator.share === 'function'));
    effect(() => {
      const d = this.data().data;
      if (!d) {
        return;
      }
      const post = d.post;
      const lang = this.locale.lang();
      const image = post.coverAsset ? fileUrl(post.coverAsset.publicId, 'full') : null;
      const orgName = this.site.site()?.settings?.orgName ?? '';
      this.seo.set({
        title: post.title,
        description: post.excerpt,
        path: this.path(),
        lang,
        image,
        type: 'article',
        noindex: d.preview,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: post.title,
            ...(post.excerpt ? { description: post.excerpt } : {}),
            ...(post.publishedOn ? { datePublished: post.publishedOn } : {}),
            ...(image ? { image: [this.origin + image] } : {}),
            inLanguage: lang,
            mainEntityOfPage: this.url(),
            ...(orgName ? { publisher: { '@type': 'NGO', name: orgName } } : {}),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { name: this.t.translate('pages.breadcrumbHome'), path: '/' },
              { name: this.t.translate('shell.footer.news'), path: '/news' },
              { name: post.title, path: this.path() },
            ].map((item, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: item.name,
              item: this.seo.url(lang, item.path),
            })),
          },
        ],
      });
    });
  }

  protected async shareNative(): Promise<void> {
    try {
      await navigator.share({ title: this.data().data?.post.title, url: this.url() });
    } catch {
      // Dismissed by the user: nothing to do.
    }
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.toast.success(this.t.translate('pages.news.linkCopied'));
    } catch {
      this.toast.error(this.t.translate('errors.generic'));
    }
  }
}
