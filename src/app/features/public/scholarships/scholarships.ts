import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { DigitsPipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { FeatureCard } from '../../../shared/ui/card/card';
import { FlowingLines } from '../../../shared/ui/flowing-lines/flowing-lines';
import { Icon } from '../../../shared/ui/icon/icon';
import { asIcon } from '../../../shared/ui/icon/as-icon';
import { Image } from '../../../shared/ui/image/image';
import { Breadcrumb } from '../../../shared/ui/page-head/breadcrumb';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { SectionHeading } from '../../../shared/ui/section-heading/section-heading';
import { plainText } from '../../../shared/text/plain-text';
import { pageSeo } from '../page-meta';
import type { ScholarshipsPageData } from './scholarships.resolver';

export { scholarshipsResolver, type ScholarshipsPageData } from './scholarships.resolver';

/**
 * Scholarships (prototype `#/scholarships`): band hero with apply/track buttons, care pillars, the
 * application steps (vertical timeline, a numbered 5-column row on xl), requirements + the apply
 * card, and a sticky apply bar on mobile.
 *
 * The mobile bar is `position: sticky` at the end of the page (not `fixed`): it takes its own
 * height in the flow (no content hidden behind it) and scrolls away with the page end, so it never
 * covers the footer.
 */
@Component({
  selector: 'app-scholarships-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    PageState,
    Breadcrumb,
    SectionHeading,
    FeatureCard,
    FlowingLines,
    Button,
    Icon,
    Image,
    Reveal,
    DigitsPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (data().failure; as failure) {
      <app-page-state [failure]="failure" />
    } @else if (data().data; as d) {
      <section
        class="band relative overflow-hidden py-12 md:py-16"
        aria-labelledby="scholarships-title"
      >
        <app-flowing-lines tone="band" [width]="420" [height]="320" />
        <div
          class="wrap relative z-1 grid items-center gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14"
        >
          <div class="flex flex-col gap-4">
            <app-breadcrumb [items]="breadcrumb()" tone="band" />
            <h1 id="scholarships-title" class="t-h1">{{ d.page.title }}</h1>
            @if (d.page.metaDescription) {
              <p class="t-lead max-w-160">{{ d.page.metaDescription }}</p>
            }
            <div class="mt-2 flex flex-wrap gap-4 [&_a]:w-full sm:[&_a]:w-auto">
              <a appButton variant="onband" [routerLink]="locale.link('/apply')">{{
                'pages.scholarships.startApplication' | transloco
              }}</a>
              <a appButton variant="onband-ghost" [routerLink]="locale.link('/portal')">{{
                'pages.scholarships.trackApplication' | transloco
              }}</a>
            </div>
          </div>
          <app-image
            [placeholder]="'pages.scholarships.heroImage' | transloco"
            [aspect]="[4, 3]"
            sizes="(min-width: 1024px) 400px, 100vw"
            imgClass="w-full h-auto rounded-card"
          />
        </div>
      </section>

      <section class="section" aria-labelledby="scholarships-pillars">
        <div class="wrap flex flex-col gap-10">
          <app-section-heading
            headingId="scholarships-pillars"
            [eyebrow]="'pages.scholarships.pillarsEyebrow' | transloco"
            [heading]="'pages.scholarships.pillarsHeading' | transloco"
          />
          <ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2">
            @for (p of d.pillars; track p.id; let i = $index) {
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
        </div>
      </section>

      @defer (on viewport; hydrate on viewport) {
        <!-- --secondary on --surface is 4.41:1 (< AA): eyebrows here use --primary. -->
        <section
          class="section bg-surface [&_.t-eyebrow]:text-primary"
          aria-labelledby="scholarships-steps"
        >
          <div class="wrap flex flex-col gap-10">
            <app-section-heading
              headingId="scholarships-steps"
              [eyebrow]="'pages.scholarships.stepsEyebrow' | transloco"
              [heading]="'pages.scholarships.stepsHeading' | transloco"
              [lead]="'pages.scholarships.stepsLead' | transloco"
            />
            <ol class="m-0 flex list-none flex-col p-0 xl:grid xl:grid-cols-5 xl:gap-5">
              @for (s of d.steps; track s.id; let i = $index; let last = $last) {
                <li
                  appReveal
                  [revealIndex]="i"
                  class="flex gap-4 xl:flex-col xl:gap-4 xl:rounded-card xl:border xl:p-6"
                  [class]="
                    last
                      ? 'xl:border-secondary xl:bg-secondary-light'
                      : 'xl:border-border xl:bg-card'
                  "
                >
                  <span class="flex shrink-0 flex-col items-center" aria-hidden="true">
                    <span
                      class="flex size-10 items-center justify-center rounded-xl font-bold text-on-primary"
                      [class.bg-primary]="!last"
                      [class.bg-secondary]="last"
                      >{{ i + 1 | digits }}</span
                    >
                    @if (!last) {
                      <span
                        class="my-2 block min-h-6 w-0.5 grow rounded-full bg-border xl:hidden"
                      ></span>
                    }
                  </span>
                  <div class="flex min-w-0 flex-col gap-2 pt-1.5 xl:pt-0" [class.pb-6]="!last">
                    <h3 class="t-h4 !text-xl">{{ s.title }}</h3>
                    @if (plain(s.body); as body) {
                      <p class="t-small t-muted">{{ body }}</p>
                    }
                  </div>
                </li>
              }
            </ol>
          </div>
        </section>
      } @placeholder {
        <div class="min-h-150 bg-surface"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <section class="section" aria-labelledby="scholarships-requirements">
          <div
            class="wrap grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center"
          >
            <div class="flex flex-col gap-6">
              <app-section-heading
                headingId="scholarships-requirements"
                [eyebrow]="'pages.scholarships.requirementsEyebrow' | transloco"
                [heading]="'pages.scholarships.requirementsHeading' | transloco"
              />
              <ul class="m-0 flex list-none flex-col gap-3 p-0">
                @for (r of d.requirements; track r.id) {
                  <li class="tile flex items-start gap-3">
                    <app-icon name="check" [size]="20" class="mt-1 text-secondary" />
                    <span>{{ r.title }}</span>
                  </li>
                }
              </ul>
            </div>
            <div appReveal class="band flex flex-col justify-center gap-5 rounded-card p-6 md:p-10">
              <h3 class="t-h2">{{ 'pages.scholarships.ctaHeading' | transloco }}</h3>
              <p class="text-band-soft">{{ 'pages.scholarships.ctaBody' | transloco }}</p>
              <a appButton variant="onband" [routerLink]="locale.link('/apply')">{{
                'pages.scholarships.ctaApply' | transloco
              }}</a>
              <a
                class="inline-flex min-h-11 items-center justify-center font-semibold text-band-soft underline-offset-4 hover:underline"
                [routerLink]="locale.link('/contact')"
                >{{ 'pages.scholarships.ctaContact' | transloco }}</a
              >
            </div>
          </div>
        </section>
      } @placeholder {
        <div class="min-h-150"></div>
      }

      <div
        class="sticky bottom-0 z-40 border-t border-border bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden print:hidden"
        data-testid="apply-bar"
      >
        <a appButton size="sm" class="w-full" [routerLink]="locale.link('/apply')">{{
          'pages.scholarships.startApplication' | transloco
        }}</a>
      </div>
    }
  `,
})
export class ScholarshipsPage {
  readonly data = input.required<Loaded<ScholarshipsPageData>>();
  protected readonly locale = inject(LocaleService);
  private readonly t = inject(TranslocoService);

  protected readonly icon = asIcon;

  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    { label: this.t.translate('shell.footer.scholarships') },
  ]);

  private readonly seo = pageSeo();

  constructor() {
    effect(() => this.seo({ page: this.data().data?.page, path: '/scholarships' }));
  }

  /** About-item bodies are sanitized HTML (C26); these slots take plain text. */
  protected readonly plain = plainText;
}
