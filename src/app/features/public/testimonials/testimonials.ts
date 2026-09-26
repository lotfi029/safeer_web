import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { PageHead } from '../../../shared/ui/page-head/page-head';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { SectionHeading } from '../../../shared/ui/section-heading/section-heading';
import { Pill } from '../../../shared/ui/status-pill/status-pill';
import { pageSeo } from '../page-meta';
import type { TestimonialsPageData } from './testimonials.resolver';

export { testimonialsResolver, type TestimonialsPageData } from './testimonials.resolver';

/**
 * Testimonials (prototype `#/testimonials`): page head, featured quote, the themes grid (improvement
 * themes carry a warn pill) ending with the "share your feedback" band card, then the testimonial
 * grid. `authorName` is not bilingual in the API and is shown as-is.
 */
@Component({
  selector: 'app-testimonials-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    PageState,
    PageHead,
    SectionHeading,
    Button,
    Icon,
    Pill,
    Reveal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().failure; as failure) {
      <app-page-state [failure]="failure" />
    } @else if (data().data; as d) {
      <app-page-head
        headingId="testimonials-title"
        [title]="d.page.title"
        [lead]="d.page.metaDescription"
        [breadcrumb]="breadcrumb()"
      />

      @if (featured().length) {
        <section
          class="section pb-0"
          [attr.aria-label]="'pages.testimonials.featuredLabel' | transloco"
        >
          <div class="wrap flex flex-col gap-8">
            @for (t of featured(); track t.id) {
              <figure
                appReveal
                class="card m-0 flex flex-col gap-6 bg-surface md:flex-row md:items-start md:gap-10 lg:px-13 lg:py-12"
              >
                <app-icon name="quote" [size]="44" class="text-secondary" />
                <div class="flex min-w-0 grow flex-col gap-5">
                  <blockquote class="m-0">
                    <p class="text-xl leading-[1.95] font-medium text-heading md:text-[26px]">
                      {{ t.quote || ('common.placeholder' | transloco) }}
                    </p>
                  </blockquote>
                  <figcaption class="flex items-center gap-3.5 border-t border-border pt-5">
                    <span
                      class="icon-tile size-12 rounded-[14px] font-bold text-heading"
                      aria-hidden="true"
                    >
                      @if (initial(t.authorName); as i) {
                        {{ i }}
                      } @else {
                        <app-icon name="user" [size]="22" />
                      }
                    </span>
                    <span class="flex min-w-0 flex-col">
                      <strong class="text-heading">{{
                        t.authorName || ('common.placeholder' | transloco)
                      }}</strong>
                      @if (t.authorDesc) {
                        <span class="t-caption">{{ t.authorDesc }}</span>
                      }
                    </span>
                  </figcaption>
                </div>
              </figure>
            }
          </div>
        </section>
      }

      @defer (on viewport; hydrate on viewport) {
        <section class="section pt-12 md:pt-16" aria-labelledby="testimonials-themes">
          <div class="wrap flex flex-col gap-10">
            <app-section-heading
              headingId="testimonials-themes"
              [eyebrow]="'pages.testimonials.themesEyebrow' | transloco"
              [heading]="'pages.testimonials.themesHeading' | transloco"
            />
            <ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
              @for (theme of themes(); track theme.id; let i = $index) {
                <li
                  appReveal
                  [revealIndex]="i"
                  class="card card-hover flex flex-col gap-3"
                  [class.bg-surface]="theme.isImprovement"
                  [attr.data-improvement]="theme.isImprovement ? 'true' : null"
                >
                  <div class="flex items-center gap-3">
                    <span
                      class="icon-tile size-12 rounded-xl"
                      [class.!bg-card]="theme.isImprovement"
                      [class.!text-alert]="theme.isImprovement"
                    >
                      <app-icon
                        [name]="theme.isImprovement ? 'calendar' : 'book-open'"
                        [size]="24"
                      />
                    </span>
                    @if (theme.isImprovement) {
                      <app-pill variant="warn">{{
                        'pages.testimonials.improvement' | transloco
                      }}</app-pill>
                    }
                  </div>
                  <h3 class="t-h4 mt-2">{{ theme.title }}</h3>
                  @if (theme.description) {
                    <p class="t-muted">{{ theme.description }}</p>
                  }
                </li>
              }
              <li
                appReveal
                [revealIndex]="themes().length"
                class="card band flex flex-col justify-center gap-4 border-transparent"
              >
                <h3 class="t-h4">{{ 'pages.testimonials.shareHeading' | transloco }}</h3>
                <p class="t-muted">{{ 'pages.testimonials.shareBody' | transloco }}</p>
                <a
                  appButton
                  variant="onband"
                  [routerLink]="locale.link('/contact')"
                  [queryParams]="{ subject: 'feedback' }"
                  >{{ 'pages.testimonials.shareAction' | transloco }}</a
                >
              </li>
            </ul>
          </div>
        </section>
      } @placeholder {
        <div class="min-h-150"></div>
      }

      @if (list().length) {
        @defer (on viewport; hydrate on viewport) {
          <section class="section pt-0" aria-labelledby="testimonials-list">
            <div class="wrap flex flex-col gap-6">
              <h2 class="sr-only" id="testimonials-list">
                {{ 'pages.testimonials.listHeading' | transloco }}
              </h2>
              <ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
                @for (t of list(); track t.id; let i = $index) {
                  <li appReveal [revealIndex]="i" class="flex">
                    <figure class="card m-0 flex grow flex-col justify-between gap-4">
                      <blockquote class="m-0">
                        <p class="leading-[1.95]">
                          {{ t.quote || ('common.placeholder' | transloco) }}
                        </p>
                      </blockquote>
                      <figcaption class="flex items-center gap-3 border-t border-border pt-4">
                        <span
                          class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface font-bold text-heading"
                          aria-hidden="true"
                          >{{ initial(t.authorName) }}</span
                        >
                        <span class="flex min-w-0 flex-col">
                          <strong class="t-small t-muted">{{
                            t.authorName || ('common.placeholder' | transloco)
                          }}</strong>
                          @if (t.authorDesc) {
                            <span class="t-caption">{{ t.authorDesc }}</span>
                          }
                        </span>
                      </figcaption>
                    </figure>
                  </li>
                }
              </ul>
            </div>
          </section>
        } @placeholder {
          <div class="min-h-80"></div>
        }
      }
    }
  `,
})
export class TestimonialsPage {
  readonly data = input.required<Loaded<TestimonialsPageData>>();
  protected readonly locale = inject(LocaleService);
  private readonly t = inject(TranslocoService);

  protected readonly featured = computed(() =>
    sorted(this.data().data?.testimonials.featured ?? []),
  );
  protected readonly list = computed(() => sorted(this.data().data?.testimonials.list ?? []));
  protected readonly themes = computed(() => sorted(this.data().data?.testimonials.themes ?? []));

  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    { label: this.t.translate('pages.testimonials.crumb') },
  ]);

  private readonly seo = pageSeo();

  constructor() {
    effect(() => this.seo({ page: this.data().data?.page, path: '/testimonials' }));
  }

  /** First letter of the author's name for the avatar tile ('' for placeholders like "[…]"). */
  protected initial(name: string | null | undefined): string {
    return name?.trim().match(/^\p{L}/u)?.[0] ?? '';
  }
}

function sorted<T extends { sortOrder: number }>(items: readonly T[]): T[] {
  return items.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}
