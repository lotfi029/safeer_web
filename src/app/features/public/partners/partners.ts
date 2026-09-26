import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import type { PartnerCategory } from '../../../core/api/models';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { Button } from '../../../shared/ui/button/button';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../shared/ui/icon/icon';
import { Image } from '../../../shared/ui/image/image';
import { Note } from '../../../shared/ui/note/note';
import { PageHead } from '../../../shared/ui/page-head/page-head';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { pageSeo } from '../page-meta';
import type { PartnersPageData } from './partners.resolver';

export { partnersResolver, type PartnersPageData } from './partners.resolver';

export const PARTNER_CATEGORIES: readonly PartnerCategory[] = [
  'government',
  'university',
  'association',
  'supporter',
];

function asCategory(value: string | null): PartnerCategory | null {
  return value && (PARTNER_CATEGORIES as readonly string[]).includes(value)
    ? (value as PartnerCategory)
    : null;
}

/**
 * Partners (prototype `#/partners`): category chips (crawlable `?category=` links with
 * aria-current), logo grid (a card links out when the partner has an https URL), info note and the
 * "partner with us" CTA → contact with subject `partnership`.
 */
@Component({
  selector: 'app-partners-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
    PageState,
    PageHead,
    Button,
    EmptyState,
    Icon,
    Image,
    Note,
    Reveal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().failure; as failure) {
      <app-page-state [failure]="failure" />
    } @else if (data().data; as d) {
      <app-page-head
        headingId="partners-title"
        [title]="d.page.title"
        [lead]="d.page.metaDescription"
        [breadcrumb]="breadcrumb()"
      />

      <section class="section" aria-labelledby="partners-title">
        <div class="wrap flex flex-col gap-8">
          <div
            class="-my-1 flex min-w-0 overflow-x-auto py-1"
            role="group"
            [attr.aria-label]="'pages.partners.filterLabel' | transloco"
          >
            <ul class="m-0 flex list-none gap-2.5 p-0">
              @for (chip of chips(); track chip.value) {
                <li class="shrink-0">
                  <a
                    class="chip"
                    [routerLink]="[]"
                    [queryParams]="{ category: chip.value }"
                    [attr.aria-current]="chip.value === category() ? 'page' : null"
                    >{{ chip.label }}</a
                  >
                </li>
              }
            </ul>
          </div>

          @if (partners().length) {
            <ul
              class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4"
              data-testid="partners-grid"
            >
              @for (p of partners(); track p.id; let i = $index) {
                <li
                  appReveal
                  [revealIndex]="i % 4"
                  class="flex min-w-0"
                  [attr.data-category]="p.category"
                >
                  @if (isExternal(p.url)) {
                    <a
                      class="card card-hover group flex min-w-0 grow flex-col items-center justify-center gap-3 !p-4 text-center no-underline md:!p-6"
                      [href]="p.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      [attr.aria-label]="'pages.partners.visit' | transloco: { name: p.name }"
                    >
                      <ng-container
                        [ngTemplateOutlet]="logo"
                        [ngTemplateOutletContext]="{ $implicit: p }"
                      />
                      <span class="inline-flex items-center gap-1.5 font-semibold text-heading">
                        {{ p.name || ('common.placeholder' | transloco) }}
                        <app-icon name="external-link" [size]="16" />
                      </span>
                    </a>
                  } @else {
                    <div
                      class="card card-hover flex min-w-0 grow flex-col items-center justify-center gap-3 !p-4 text-center md:!p-6"
                    >
                      <ng-container
                        [ngTemplateOutlet]="logo"
                        [ngTemplateOutletContext]="{ $implicit: p }"
                      />
                      <span class="font-semibold text-heading">{{
                        p.name || ('common.placeholder' | transloco)
                      }}</span>
                    </div>
                  }
                </li>
              }
            </ul>
          } @else {
            <app-empty-state icon="handshake" />
          }

          <ng-template #logo let-p>
            <app-image
              class="w-full max-w-44"
              [asset]="p.logoAsset"
              alt=""
              [placeholder]="p.name"
              [aspect]="[5, 2]"
              sizes="176px"
              imgClass="block h-16 w-full object-contain !gap-0 !rounded-[10px] !p-2 !text-xs !leading-snug"
            />
          </ng-template>

          <app-note>{{ 'pages.partners.note' | transloco }}</app-note>

          @defer (on viewport; hydrate on viewport) {
            <div
              class="card flex flex-col gap-6 bg-surface lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:py-11"
            >
              <div class="flex max-w-160 flex-col gap-3">
                <h2 class="t-h3">{{ 'pages.partners.ctaHeading' | transloco }}</h2>
                <p class="t-muted">{{ 'pages.partners.ctaBody' | transloco }}</p>
              </div>
              <a
                appButton
                class="w-full shrink-0 sm:w-auto"
                [routerLink]="locale.link('/contact')"
                [queryParams]="{ subject: 'partnership' }"
                >{{ 'pages.partners.ctaAction' | transloco }}</a
              >
            </div>
          } @placeholder {
            <div class="min-h-60"></div>
          }
        </div>
      </section>
    }
  `,
})
export class PartnersPage {
  readonly data = input.required<Loaded<PartnersPageData>>();
  protected readonly locale = inject(LocaleService);
  private readonly t = inject(TranslocoService);

  protected readonly category = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => asCategory(q.get('category')))),
    { initialValue: null },
  );

  protected readonly chips = computed(() => {
    this.data(); // re-translate when the language (and so the resolved data) changes
    return [
      { value: null, label: this.t.translate('common.all') },
      ...PARTNER_CATEGORIES.map((c) => ({
        value: c,
        label: this.t.translate(`pages.partners.categories.${c}`),
      })),
    ];
  });

  protected readonly partners = computed(() => {
    const category = this.category();
    return (this.data().data?.partners ?? [])
      .filter((p) => !category || p.category === category)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    { label: this.t.translate('pages.partners.crumb') },
  ]);

  private readonly seo = pageSeo();

  constructor() {
    effect(() => this.seo({ page: this.data().data?.page, path: '/partners' }));
  }

  /** Only https URLs become outbound links (never javascript:/http: from the CMS). */
  protected isExternal(url: string | null): url is string {
    return !!url && /^https:\/\//i.test(url);
  }
}
