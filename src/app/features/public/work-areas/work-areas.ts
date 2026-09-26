import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { DigitsPipe } from '../../../shared/pipes/format';
import { Accordion, AccordionItem } from '../../../shared/ui/accordion/accordion';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { asIcon } from '../../../shared/ui/icon/as-icon';
import { PageHead } from '../../../shared/ui/page-head/page-head';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { SectionHeading } from '../../../shared/ui/section-heading/section-heading';
import { Pill } from '../../../shared/ui/status-pill/status-pill';
import { pageSeo } from '../page-meta';
import type { WorkAreasPageData } from './work-areas.resolver';

export { workAreasResolver, type WorkAreasPageData } from './work-areas.resolver';

/**
 * Our work (prototype `#/work`): page head, the work areas (an accordion below md, full cards from
 * md) and the band with the recurring testimonial themes (improvement themes flagged).
 */
@Component({
  selector: 'app-work-areas-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
    PageState,
    PageHead,
    SectionHeading,
    Accordion,
    AccordionItem,
    Button,
    Icon,
    Pill,
    Reveal,
    DigitsPipe,
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

      <section class="section" aria-labelledby="work-areas">
        <div class="wrap">
          <h2 id="work-areas" class="sr-only">{{ 'shell.footer.work' | transloco }}</h2>

          <!-- Mobile: one accordion item per area (first open). -->
          <app-accordion class="md:hidden" data-testid="work-accordion">
            @for (a of d.areas; track a.id; let i = $index) {
              <app-accordion-item [heading]="a.title" [open]="i === 0">
                <div class="flex flex-col gap-4">
                  <span class="t-eyebrow" aria-hidden="true">{{ number(i) | digits }}</span>
                  <ng-container
                    [ngTemplateOutlet]="itemsList"
                    [ngTemplateOutletContext]="{ $implicit: a, odd: false }"
                  />
                </div>
              </app-accordion-item>
            }
          </app-accordion>

          <!-- md+: full cards, alternating surfaces. -->
          <ul class="m-0 hidden list-none flex-col gap-6 p-0 md:flex">
            @for (a of d.areas; track a.id; let i = $index; let odd = $odd) {
              <li
                appReveal
                [revealIndex]="i"
                class="card grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10 lg:!px-11 lg:!py-10"
                [class.bg-surface]="odd"
              >
                <div class="flex flex-col gap-4">
                  <span class="icon-tile size-14" [class.!bg-card]="odd"
                    ><app-icon [name]="icon(a.icon)" [size]="28"
                  /></span>
                  <h3 class="t-h3">{{ a.title }}</h3>
                  <!-- --secondary on --surface is 4.41:1 (< AA): --primary on odd cards. -->
                  <span class="t-eyebrow" [class.!text-primary]="odd" aria-hidden="true">{{
                    number(i) | digits
                  }}</span>
                </div>
                <ng-container
                  [ngTemplateOutlet]="itemsList"
                  [ngTemplateOutletContext]="{ $implicit: a, odd: odd }"
                />
              </li>
            }
          </ul>
        </div>
      </section>

      <ng-template #itemsList let-a let-odd="odd">
        @if (a.items.length) {
          <ul
            class="m-0 grid list-none grid-cols-1 content-start gap-3 p-0 sm:grid-cols-2 md:gap-x-10 md:gap-y-4"
          >
            @for (item of a.items; track item.id) {
              <li class="tile flex items-start gap-3" [class.!bg-card]="odd">
                <app-icon name="check" [size]="20" class="mt-1 text-secondary" />
                <span>{{ item.text }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="t-muted">{{ 'common.placeholder' | transloco }}</p>
        }
      </ng-template>

      @if (d.themes.length) {
        @defer (on viewport; hydrate on viewport) {
          <section class="band section" aria-labelledby="work-themes">
            <div class="wrap flex flex-col gap-8">
              <app-section-heading
                headingId="work-themes"
                [eyebrow]="'pages.work.themesEyebrow' | transloco"
                [heading]="'pages.work.themesHeading' | transloco"
              >
                <a
                  headingAction
                  appButton
                  variant="onband-ghost"
                  size="sm"
                  [routerLink]="locale.link('/testimonials')"
                  >{{ 'pages.work.allTestimonials' | transloco }}</a
                >
              </app-section-heading>
              <ul class="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 lg:grid-cols-3">
                @for (t of d.themes; track t.id; let i = $index) {
                  <li
                    appReveal
                    [revealIndex]="i"
                    class="flex flex-col gap-3 rounded-card bg-band-card p-6 md:p-8"
                    [class.border]="t.isImprovement"
                    [class.border-(--band-dim)]="t.isImprovement"
                  >
                    @if (t.isImprovement) {
                      <app-pill class="self-start" variant="warn">{{
                        'pages.work.improvement' | transloco
                      }}</app-pill>
                    }
                    <h3 class="t-h4">{{ t.title }}</h3>
                    @if (t.description) {
                      <p class="text-band-soft">{{ t.description }}</p>
                    }
                  </li>
                }
              </ul>
            </div>
          </section>
        } @placeholder {
          <div class="band min-h-100"></div>
        }
      }
    }
  `,
})
export class WorkAreasPage {
  readonly data = input.required<Loaded<WorkAreasPageData>>();
  protected readonly locale = inject(LocaleService);
  private readonly t = inject(TranslocoService);

  protected readonly icon = asIcon;

  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    { label: this.t.translate('shell.footer.work') },
  ]);

  private readonly seo = pageSeo();

  constructor() {
    effect(() => this.seo({ page: this.data().data?.page, path: '/work-areas' }));
  }

  /** "01", "02", … (localised by the `digits` pipe). */
  protected number(index: number): string {
    return String(index + 1).padStart(2, '0');
  }
}
