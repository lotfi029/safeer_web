import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { HomeResponse, PageSection } from '../../../core/api/models';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { SITE_ORIGIN } from '../../../core/config/site-origin';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { Counter } from '../../../shared/ui/counter/counter';
import { FeatureCard } from '../../../shared/ui/card/card';
import { FlowingLines } from '../../../shared/ui/flowing-lines/flowing-lines';
import { Icon } from '../../../shared/ui/icon/icon';
import { asIcon } from '../../../shared/ui/icon/as-icon';
import { Image } from '../../../shared/ui/image/image';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { RichText } from '../../../shared/ui/rich-text/rich-text';
import { SectionHeading } from '../../../shared/ui/section-heading/section-heading';
import { plainText } from '../../../shared/text/plain-text';
import { NewsCard } from '../news/news-card';
import { SectionButton } from '../section-link';

export { homeResolver } from './home.resolver';

/** Section keys this page knows how to render (seed order in CONTRACT-NOTES). Others are skipped. */
export const HOME_SECTION_KEYS = [
  'hero',
  'about',
  'impact',
  'work_areas',
  'student_care',
  'news',
  'testimonials',
  'partners',
  'cta',
] as const;

/**
 * W6: sections whose CMS `label` the prototype shows as an eyebrow. For the others (hero, cta) the
 * label is only the section's name in the admin («الواجهة الرئيسية» / "Hero") and never renders.
 */
export const EYEBROW_SECTION_KEYS: ReadonlySet<string> = new Set([
  'about',
  'impact',
  'work_areas',
  'student_care',
  'news',
  'testimonials',
  'partners',
]);

/**
 * Home (prototype `#/home`). Sections render by `sectionKey` in API order; unpublished sections are
 * never returned by the API, unknown keys are skipped. Everything below the hero is deferred and
 * hydrated on viewport (incremental hydration); SSR still renders it in full.
 */
@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    PageState,
    Counter,
    FeatureCard,
    FlowingLines,
    Icon,
    Image,
    Reveal,
    RichText,
    SectionHeading,
    NewsCard,
    SectionButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().failure; as failure) {
      <app-page-state [failure]="failure" />
    } @else if (data().data; as home) {
      @for (s of sections(); track s.id; let first = $first) {
        @switch (s.sectionKey) {
          @case ('hero') {
            <section
              class="relative overflow-hidden bg-hero py-11 md:py-21"
              [attr.aria-labelledby]="'s-' + s.id"
            >
              <app-flowing-lines />
              <div
                class="wrap relative z-1 grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14"
              >
                <div class="flex flex-col gap-6">
                  <h1 class="t-display whitespace-pre-line" [id]="'s-' + s.id">{{ s.heading }}</h1>
                  @if (s.body) {
                    <app-rich-text class="t-lead max-w-135" [html]="s.body" />
                  }
                  <div class="flex flex-wrap gap-4 [&_a]:w-full sm:[&_a]:w-auto">
                    <app-section-button
                      [label]="s.primaryButtonLabel"
                      [url]="s.primaryButtonUrl"
                      [arrow]="true"
                    />
                    <app-section-button
                      variant="ghost"
                      [label]="s.secondaryButtonLabel"
                      [url]="s.secondaryButtonUrl"
                    />
                  </div>
                </div>
                <app-image
                  [asset]="s.imageAsset"
                  [placeholder]="'pages.home.heroImage' | transloco"
                  [aspect]="[5, 4]"
                  [priority]="first"
                  sizes="(min-width: 1024px) 560px, 100vw"
                  imgClass="block w-full h-auto rounded-card"
                />
              </div>
            </section>
          }
          @case ('about') {
            @defer (on viewport; hydrate on viewport) {
              <section class="section" [attr.aria-labelledby]="'s-' + s.id">
                <div class="wrap grid items-center gap-10 lg:grid-cols-2">
                  <app-image
                    appReveal
                    [asset]="s.imageAsset"
                    [placeholder]="'pages.home.aboutImage' | transloco"
                    [aspect]="[6, 5]"
                    sizes="(min-width: 1024px) 560px, 100vw"
                    imgClass="block w-full h-auto rounded-card"
                  />
                  <div class="flex flex-col gap-5">
                    <app-section-heading
                      [headingId]="'s-' + s.id"
                      [eyebrow]="eyebrow(s)"
                      [heading]="s.heading ?? ''"
                      [lead]="plain(s.body)"
                    />
                    <ul class="m-0 flex list-none flex-col gap-3 p-0">
                      @for (g of home.aboutItems.goals; track g.id) {
                        <li class="flex items-start gap-3">
                          <app-icon name="check" [size]="22" class="mt-1 text-secondary" />
                          <span>{{ g.title }}</span>
                        </li>
                      }
                    </ul>
                    <app-section-button
                      variant="text"
                      [label]="s.primaryButtonLabel"
                      [url]="s.primaryButtonUrl"
                    />
                  </div>
                </div>
              </section>
            } @placeholder {
              <div class="min-h-100"></div>
            }
          }
          @case ('impact') {
            @defer (on viewport; hydrate on viewport) {
              <section class="band py-14 md:py-16" [attr.aria-labelledby]="'s-' + s.id">
                <div class="wrap grid items-center gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div class="flex flex-col gap-2">
                    @if (eyebrow(s); as label) {
                      <p class="t-eyebrow">{{ label }}</p>
                    }
                    <h2 class="t-h3" [id]="'s-' + s.id">{{ s.heading }}</h2>
                    @if (s.body) {
                      <app-rich-text class="t-small text-band-soft" [html]="s.body" />
                    }
                  </div>
                  <ul
                    class="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 xl:grid-cols-4"
                  >
                    @for (stat of home.stats; track stat.id; let i = $index) {
                      <li
                        appReveal
                        [revealIndex]="i"
                        class="flex flex-col gap-1 rounded-card bg-band-card p-6"
                      >
                        <app-counter
                          class="text-[44px] leading-tight font-bold text-(--band-dim)"
                          [value]="stat.value"
                        />
                        <span class="text-band-soft">{{ stat.label }}</span>
                        @if (stat.sub) {
                          <span class="t-small text-band-soft">{{ stat.sub }}</span>
                        }
                      </li>
                    }
                  </ul>
                </div>
              </section>
            } @placeholder {
              <div class="band min-h-60"></div>
            }
          }
          @case ('work_areas') {
            @defer (on viewport; hydrate on viewport) {
              <section class="section" [attr.aria-labelledby]="'s-' + s.id">
                <div class="wrap flex flex-col gap-10">
                  <app-section-heading
                    [headingId]="'s-' + s.id"
                    [eyebrow]="eyebrow(s)"
                    [heading]="s.heading ?? ''"
                    [lead]="plain(s.body)"
                  >
                    <app-section-button
                      headingAction
                      variant="text"
                      [label]="s.primaryButtonLabel"
                      [url]="s.primaryButtonUrl"
                    />
                  </app-section-heading>
                  <ul
                    class="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 xl:grid-cols-4"
                  >
                    @for (a of home.workAreas; track a.id; let i = $index) {
                      <li appReveal [revealIndex]="i" class="flex">
                        <app-feature-card
                          class="grow"
                          [icon]="icon(a.icon)"
                          [heading]="a.title"
                          [body]="itemsText(a.items)"
                        />
                      </li>
                    }
                  </ul>
                </div>
              </section>
            } @placeholder {
              <div class="min-h-100"></div>
            }
          }
          @case ('student_care') {
            @defer (on viewport; hydrate on viewport) {
              <section class="section bg-surface" [attr.aria-labelledby]="'s-' + s.id">
                <div class="wrap flex flex-col gap-10">
                  <app-section-heading
                    [headingId]="'s-' + s.id"
                    [eyebrow]="eyebrow(s)"
                    [heading]="s.heading ?? ''"
                    [lead]="plain(s.body)"
                  />
                  <ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2">
                    @for (p of home.aboutItems.carePillars; track p.id; let i = $index) {
                      <li appReveal [revealIndex]="i" class="flex">
                        <app-feature-card
                          class="grow"
                          [icon]="icon(p.icon)"
                          [heading]="p.title"
                          [body]="plain(p.body)"
                        />
                      </li>
                    }
                  </ul>
                  <div>
                    <app-section-button
                      variant="soft"
                      [label]="s.primaryButtonLabel"
                      [url]="s.primaryButtonUrl"
                    />
                  </div>
                </div>
              </section>
            } @placeholder {
              <div class="min-h-100"></div>
            }
          }
          @case ('news') {
            @if (home.news.length) {
              @defer (on viewport; hydrate on viewport) {
                <section class="section" [attr.aria-labelledby]="'s-' + s.id">
                  <div class="wrap flex flex-col gap-10">
                    <app-section-heading
                      [headingId]="'s-' + s.id"
                      [eyebrow]="eyebrow(s)"
                      [heading]="s.heading ?? ''"
                      [lead]="plain(s.body)"
                    >
                      <app-section-button
                        headingAction
                        variant="text"
                        [label]="s.primaryButtonLabel"
                        [url]="s.primaryButtonUrl"
                      />
                    </app-section-heading>
                    <ul
                      class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3"
                    >
                      @for (post of home.news; track post.id; let i = $index) {
                        <li appReveal [revealIndex]="i" class="flex">
                          <app-news-card class="grow" [post]="post" />
                        </li>
                      }
                    </ul>
                  </div>
                </section>
              } @placeholder {
                <div class="min-h-100"></div>
              }
            }
          }
          @case ('testimonials') {
            @if (home.testimonials.length) {
              @defer (on viewport; hydrate on viewport) {
                <section class="section bg-surface" [attr.aria-labelledby]="'s-' + s.id">
                  <div class="wrap flex flex-col gap-8">
                    <app-section-heading
                      [headingId]="'s-' + s.id"
                      [eyebrow]="eyebrow(s)"
                      [heading]="s.heading ?? ''"
                      [lead]="plain(s.body)"
                    >
                      <app-section-button
                        headingAction
                        variant="text"
                        [label]="s.primaryButtonLabel"
                        [url]="s.primaryButtonUrl"
                      />
                    </app-section-heading>
                    <ul class="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2">
                      @for (t of home.testimonials; track t.id; let i = $index) {
                        <li appReveal [revealIndex]="i" class="card flex flex-col gap-4">
                          <app-icon name="quote" [size]="28" class="text-secondary" />
                          <blockquote class="m-0 leading-[1.95]">{{ t.quote }}</blockquote>
                          <p class="t-caption border-t border-border pt-3 font-semibold">
                            {{ t.authorName }}
                            @if (t.authorDesc) {
                              <span class="font-normal"> · {{ t.authorDesc }}</span>
                            }
                          </p>
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
          @case ('partners') {
            @defer (on viewport; hydrate on viewport) {
              <section class="section" [attr.aria-labelledby]="'s-' + s.id">
                <div class="wrap flex flex-col gap-8">
                  <app-section-heading
                    [headingId]="'s-' + s.id"
                    [eyebrow]="eyebrow(s)"
                    [heading]="s.heading ?? ''"
                    [lead]="plain(s.body)"
                  />
                  <ul class="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-4">
                    @for (p of home.partners.slice(0, 8); track p.id) {
                      <li class="card flex h-23 items-center justify-center !p-3">
                        <app-image
                          [asset]="p.logoAsset"
                          [alt]="p.name"
                          [placeholder]="p.name"
                          [aspect]="[3, 2]"
                          sizes="200px"
                          imgClass="max-h-16 w-auto object-contain !bg-transparent !p-0 !text-xs"
                        />
                      </li>
                    }
                  </ul>
                  <a class="font-semibold" [routerLink]="locale.link('/partners')">{{
                    'pages.home.allPartners' | transloco
                  }}</a>
                </div>
              </section>
            } @placeholder {
              <div class="min-h-60"></div>
            }
          }
          @case ('cta') {
            @defer (on viewport; hydrate on viewport) {
              <section class="band py-14 md:py-16" [attr.aria-labelledby]="'s-' + s.id">
                <div
                  class="wrap flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div class="flex max-w-155 flex-col gap-3">
                    <h2 class="t-h2" [id]="'s-' + s.id">{{ s.heading }}</h2>
                    @if (s.body) {
                      <app-rich-text class="t-lead" [html]="s.body" />
                    }
                  </div>
                  <div class="flex flex-wrap gap-4 [&_a]:w-full sm:[&_a]:w-auto">
                    <app-section-button
                      variant="onband"
                      [label]="s.primaryButtonLabel"
                      [url]="s.primaryButtonUrl"
                    />
                    <app-section-button
                      variant="onband-ghost"
                      [label]="s.secondaryButtonLabel"
                      [url]="s.secondaryButtonUrl"
                    />
                  </div>
                </div>
              </section>
            } @placeholder {
              <div class="band min-h-60"></div>
            }
          }
        }
      }
    }
  `,
})
export class HomePage {
  readonly data = input.required<Loaded<HomeResponse>>();
  protected readonly locale = inject(LocaleService);
  private readonly seo = inject(SeoService);
  private readonly origin = inject(SITE_ORIGIN);

  protected readonly sections = computed<PageSection[]>(() =>
    (this.data().data?.sections ?? [])
      .filter((s) => (HOME_SECTION_KEYS as readonly string[]).includes(s.sectionKey))
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  protected readonly icon = asIcon;

  protected eyebrow(s: PageSection): string | null {
    return EYEBROW_SECTION_KEYS.has(s.sectionKey) ? s.label : null;
  }

  constructor() {
    effect(() => {
      const home = this.data().data;
      const settings = home?.settings;
      const name = settings?.orgName ?? '';
      this.seo.set({
        title: settings?.seoTitle || name,
        rawTitle: true,
        description: settings?.seoDescription || settings?.footerBlurb || null,
        path: '/',
        lang: this.locale.lang(),
        jsonLd: settings
          ? [
              {
                '@context': 'https://schema.org',
                '@type': 'NGO',
                name,
                url: `${this.origin}/${this.locale.lang()}`,
                logo: `${this.origin}/brand/safeer-logo.png`,
                ...(settings.email ? { email: settings.email } : {}),
                ...(settings.phone ? { telephone: settings.phone } : {}),
                ...(settings.address
                  ? {
                      address: {
                        '@type': 'PostalAddress',
                        streetAddress: settings.address,
                        addressCountry: 'SA',
                      },
                    }
                  : {}),
                // W20: every profile the settings carry.
                sameAs: [
                  settings.facebookUrl,
                  settings.instagramUrl,
                  settings.xUrl,
                  settings.youtubeUrl,
                  settings.linkedinUrl,
                  settings.whatsappUrl,
                  settings.tiktokUrl,
                ].filter(Boolean),
              },
            ]
          : [],
      });
    });
  }

  protected itemsText(items: { text: string }[]): string {
    return items.map((i) => i.text).join(' · ');
  }

  /** Section/about-item bodies are sanitized HTML (C26); some slots only take plain text. */
  protected readonly plain = plainText;
}
