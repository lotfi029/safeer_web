import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import type { Asset } from '../../../core/api/models';
import { fileUrl } from '../../../core/api/public-api';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { FileSizePipe, LocalDatePipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../shared/ui/icon/icon';
import { PageHead } from '../../../shared/ui/page-head/page-head';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { pageSeo } from '../page-meta';
import type { DocumentsPageData } from './documents.resolver';

export { documentsResolver, type DocumentsPageData } from './documents.resolver';

/** Short type label from the MIME type: application/pdf → PDF, image/png → PNG. */
function typeLabel(asset: Asset): string {
  const sub = asset.mimeType?.split('/')[1]?.split(/[;+.-]/)[0] ?? '';
  return /^[a-z0-9]{2,5}$/i.test(sub) ? sub.toUpperCase() : '';
}

/**
 * Documents (prototype `#/documents`): on lg+ a sticky side nav of category links next to the
 * content, below lg a scrolling chip row. Each category is a section (`id` = slug) with a grid of
 * file cards and a download link to `/files/<publicId>`. Links carry `?category=<slug>#<slug>`, so
 * the active category is part of the URL and deep links from other pages (`?category=…`) scroll to
 * their section after render.
 */
@Component({
  selector: 'app-documents-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    FileSizePipe,
    LocalDatePipe,
    PageState,
    PageHead,
    Button,
    EmptyState,
    Icon,
    Reveal,
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

      <div class="section">
        @if (groups().length) {
          <div class="wrap grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
            <!-- < lg: chip row that scrolls inside itself. -->
            <nav
              class="-my-1 flex min-w-0 overflow-x-auto py-1 lg:hidden"
              [attr.aria-label]="'pages.documents.sections' | transloco"
            >
              <ul class="m-0 flex list-none gap-2.5 p-0">
                @for (g of groups(); track g.category.id) {
                  <li class="shrink-0">
                    <a
                      class="chip"
                      [routerLink]="[]"
                      [queryParams]="{ category: g.category.slug }"
                      [fragment]="g.category.slug"
                      [attr.aria-current]="g.category.slug === active() ? 'true' : null"
                      >{{ g.category.name }}</a
                    >
                  </li>
                }
              </ul>
            </nav>

            <!-- lg+: sticky side nav. -->
            <nav
              class="hidden flex-col gap-2.5 lg:sticky lg:top-24 lg:flex"
              aria-labelledby="documents-nav"
            >
              <p class="t-eyebrow mb-1.5" id="documents-nav">
                {{ 'pages.documents.sections' | transloco }}
              </p>
              <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
                @for (g of groups(); track g.category.id) {
                  @let current = g.category.slug === active();
                  <li>
                    <a
                      class="tile flex min-h-11 items-center border no-underline"
                      [class]="
                        current
                          ? 'border-primary !bg-primary font-semibold text-on-primary'
                          : 'border-border !bg-card font-medium text-text hover:border-secondary'
                      "
                      [routerLink]="[]"
                      [queryParams]="{ category: g.category.slug }"
                      [fragment]="g.category.slug"
                      [attr.aria-current]="current ? 'true' : null"
                      >{{ g.category.name }}</a
                    >
                  </li>
                }
              </ul>
            </nav>

            <div class="flex min-w-0 flex-col gap-10">
              @for (g of groups(); track g.category.id) {
                <section
                  class="flex scroll-mt-24 flex-col gap-4"
                  [id]="g.category.slug"
                  [attr.aria-labelledby]="'doc-cat-' + g.category.id"
                  [attr.data-active]="g.category.slug === active() ? 'true' : null"
                >
                  <h2 class="t-h3" [id]="'doc-cat-' + g.category.id">{{ g.category.name }}</h2>
                  <ul class="m-0 grid list-none grid-cols-1 gap-4 p-0 xl:grid-cols-2">
                    @for (doc of g.documents; track doc.id; let i = $index) {
                      <li
                        appReveal
                        [revealIndex]="i"
                        class="card card-hover flex flex-wrap items-center gap-4 !px-6.5 !py-6 sm:flex-nowrap"
                      >
                        <span class="icon-tile size-12 rounded-xl">
                          <app-icon name="file" [size]="23" />
                        </span>
                        <div class="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                          <h3 class="text-base leading-relaxed font-bold text-heading">
                            {{ doc.title || ('common.placeholder' | transloco) }}
                          </h3>
                          @let size = doc.asset?.sizeBytes ? (doc.asset?.sizeBytes | fileSize) : '';
                          @let meta = join([typeOf(doc.asset), size, doc.docDate | localDate]);
                          @if (meta) {
                            <p class="t-caption">{{ meta }}</p>
                          }
                        </div>
                        @if (doc.asset; as a) {
                          <a
                            appButton
                            variant="line"
                            size="sm"
                            class="shrink-0"
                            [href]="fileHref(a.publicId)"
                            download
                          >
                            <app-icon name="download" [size]="18" />
                            {{ 'common.download' | transloco }}
                            <span class="sr-only">{{ doc.title }}</span>
                          </a>
                        }
                      </li>
                    }
                  </ul>
                </section>
              }
            </div>
          </div>
        } @else {
          <div class="wrap">
            <app-empty-state icon="file-text" />
          </div>
        }
      </div>
    }
  `,
})
export class DocumentsPage {
  readonly data = input.required<Loaded<DocumentsPageData>>();
  protected readonly locale = inject(LocaleService);
  private readonly t = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);

  protected readonly groups = computed(() =>
    (this.data().data?.groups ?? [])
      .filter((g) => g.documents.length)
      .map((g) => ({
        ...g,
        documents: g.documents.slice().sort((a, b) => a.sortOrder - b.sortOrder),
      })),
  );

  private readonly categoryParam = toSignal(
    this.route.queryParamMap.pipe(map((q) => q.get('category'))),
    { initialValue: null },
  );

  /** The category from `?category=` when it exists, else the first one. */
  protected readonly active = computed(() => {
    const slugs = this.groups().map((g) => g.category.slug);
    const wanted = this.categoryParam();
    return wanted && slugs.includes(wanted) ? wanted : (slugs[0] ?? null);
  });

  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    { label: this.t.translate('shell.footer.about'), link: this.locale.link('/about') },
    { label: this.t.translate('shell.footer.documents') },
  ]);

  private readonly seo = pageSeo();

  constructor() {
    effect(() => this.seo({ page: this.data().data?.page, path: '/documents' }));

    // Deep link `?category=<slug>` without a fragment (e.g. from the about page): scroll to it.
    // A fragment is handled by the router's anchor scrolling / the browser.
    const doc = inject(DOCUMENT);
    afterNextRender(() => {
      const wanted = this.categoryParam();
      if (!wanted || this.route.snapshot.fragment || wanted !== this.active()) {
        return;
      }
      doc.getElementById(wanted)?.scrollIntoView({ block: 'start' });
    });
  }

  protected fileHref(publicId: string): string {
    return fileUrl(publicId);
  }

  protected typeOf(asset: Asset | null): string {
    return asset ? typeLabel(asset) : '';
  }

  /** "PDF · 1.2 MB · 3 May 2024" — unknown parts (and a 0-byte size) are left out. */
  protected join(parts: string[]): string {
    return parts.filter(Boolean).join(' · ');
  }
}
