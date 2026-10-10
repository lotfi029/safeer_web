import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { AboutItem } from '../../../core/api/models';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { DigitsPipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { FeatureCard } from '../../../shared/ui/card/card';
import { Icon } from '../../../shared/ui/icon/icon';
import { asIcon } from '../../../shared/ui/icon/as-icon';
import type { IconName } from '../../../shared/ui/icon/icon-names';
import { Image } from '../../../shared/ui/image/image';
import { PageHead } from '../../../shared/ui/page-head/page-head';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { RichText } from '../../../shared/ui/rich-text/rich-text';
import { SectionHeading } from '../../../shared/ui/section-heading/section-heading';
import { plainText } from '../../../shared/text/plain-text';
import { pageSeo } from '../page-meta';
import type { AboutPageData } from './about.resolver';

export { aboutResolver, type AboutPageData } from './about.resolver';

interface GovernanceLink {
  key: string;
  titleKey: string;
  captionKey: string;
  category: string;
}

/** Governance rows (prototype `pAbout`), each linking to its documents category. */
const GOVERNANCE: readonly GovernanceLink[] = [
  {
    key: 'board',
    titleKey: 'pages.about.boardMinutes',
    captionKey: 'pages.about.minutesCaption',
    category: 'meeting-minutes',
  },
  {
    key: 'assembly',
    titleKey: 'pages.about.assemblyMinutes',
    captionKey: 'pages.about.minutesCaption',
    category: 'meeting-minutes',
  },
  {
    key: 'reports',
    titleKey: 'pages.about.activityReports',
    captionKey: 'pages.about.activityReportsCaption',
    category: 'annual-reports',
  },
];

/**
 * About (prototype `#/about`): page head, "about the association" (CMS page body when present, else
 * the page lead) with links to documents and board, vision/mission cards + numbered goals, and the
 * governance links into the documents page.
 */
@Component({
  selector: 'app-about-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    PageState,
    PageHead,
    SectionHeading,
    FeatureCard,
    Button,
    Icon,
    Image,
    Reveal,
    RichText,
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

      <section class="section" aria-labelledby="about-intro">
        <div
          class="wrap grid items-center gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-14"
        >
          <div class="flex flex-col gap-5">
            <app-section-heading
              headingId="about-intro"
              [eyebrow]="'pages.about.introEyebrow' | transloco"
              [heading]="'pages.about.introHeading' | transloco"
            />
            @if (bodies().length) {
              @for (s of bodies(); track s.id) {
                <app-rich-text class="t-muted" [html]="s.body!" />
              }
            } @else {
              <p class="t-muted">
                {{ d.page.metaDescription || ('common.placeholder' | transloco) }}
              </p>
            }
            <div class="flex flex-wrap gap-4 [&_a]:w-full sm:[&_a]:w-auto">
              <a appButton variant="soft" [routerLink]="locale.link('/documents')">{{
                'shell.footer.documents' | transloco
              }}</a>
              <a appButton variant="ghost" [routerLink]="locale.link('/board')">{{
                'shell.footer.board' | transloco
              }}</a>
            </div>
          </div>
          <app-image
            appReveal
            [asset]="image()"
            [placeholder]="'pages.about.introImage' | transloco"
            [aspect]="[6, 5]"
            sizes="(min-width: 1024px) 480px, 100vw"
            imgClass="w-full h-auto rounded-card"
          />
        </div>
      </section>

      @defer (on viewport; hydrate on viewport) {
        <!-- --secondary on --surface is 4.41:1 (< AA): eyebrows here use --primary. -->
        <section
          class="section bg-surface [&_.t-eyebrow]:text-primary"
          aria-labelledby="about-mission"
        >
          <div class="wrap flex flex-col gap-10">
            <app-section-heading
              headingId="about-mission"
              [eyebrow]="'pages.about.missionEyebrow' | transloco"
              [heading]="'pages.about.missionHeading' | transloco"
            />
            <ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2">
              @for (item of statements(); track item.id; let i = $index) {
                <li appReveal [revealIndex]="i" class="flex">
                  <app-feature-card
                    class="grow"
                    [icon]="item.icon"
                    [heading]="item.title"
                    [body]="plain(item.body) ?? ('common.placeholder' | transloco)"
                  />
                </li>
              }
            </ul>
            <div appReveal class="card flex flex-col gap-6">
              <div class="flex items-center gap-4">
                <span class="icon-tile"><app-icon name="badge-check" [size]="26" /></span>
                <h3 class="t-h4">{{ 'pages.about.goalsHeading' | transloco }}</h3>
              </div>
              @if (d.goals.length) {
                <ol
                  class="m-0 grid list-none grid-cols-1 gap-x-12 gap-y-5 p-0 md:grid-cols-2"
                  data-testid="about-goals"
                >
                  @for (g of d.goals; track g.id; let i = $index) {
                    <li class="flex items-start gap-4">
                      <span
                        class="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary font-bold text-on-primary"
                        aria-hidden="true"
                        >{{ i + 1 | digits }}</span
                      >
                      <span class="pt-0.5">{{ g.title }}</span>
                    </li>
                  }
                </ol>
              } @else {
                <p class="t-muted">{{ 'common.placeholder' | transloco }}</p>
              }
            </div>
          </div>
        </section>
      } @placeholder {
        <div class="min-h-150 bg-surface"></div>
      }

      @defer (on viewport; hydrate on viewport) {
        <section class="section" aria-labelledby="about-governance">
          <div class="wrap grid gap-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
            <app-section-heading
              headingId="about-governance"
              [eyebrow]="'pages.about.governanceEyebrow' | transloco"
              [heading]="'pages.about.governanceHeading' | transloco"
              [lead]="'pages.about.governanceLead' | transloco"
            />
            <ul class="m-0 flex list-none flex-col gap-4 p-0">
              @for (row of governance; track row.key; let i = $index) {
                <li appReveal [revealIndex]="i">
                  <a
                    class="card card-hover flex items-center gap-5 !py-6 text-inherit no-underline"
                    [routerLink]="locale.link('/documents')"
                    [queryParams]="{ category: row.category }"
                  >
                    <span class="icon-tile size-12"><app-icon name="file" [size]="22" /></span>
                    <span class="flex min-w-0 grow flex-col gap-1">
                      <strong class="text-lg text-heading">{{ row.titleKey | transloco }}</strong>
                      <span class="t-caption">{{ row.captionKey | transloco }}</span>
                    </span>
                    <app-icon name="arrow-right" [size]="20" class="text-secondary" />
                  </a>
                </li>
              }
            </ul>
          </div>
        </section>
      } @placeholder {
        <div class="min-h-100"></div>
      }
    }
  `,
})
export class AboutPage {
  readonly data = input.required<Loaded<AboutPageData>>();
  protected readonly locale = inject(LocaleService);
  private readonly t = inject(TranslocoService);

  protected readonly governance = GOVERNANCE;

  /** CMS page sections with a body (none in the current seed → the page lead is shown). */
  protected readonly bodies = computed(() =>
    (this.data().data?.page.sections ?? [])
      .filter((s) => !!s.body)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );
  protected readonly image = computed(
    () => this.bodies().find((s) => s.imageAsset)?.imageAsset ?? null,
  );

  /** Vision then mission cards; the API icon name falls back to the prototype's icons. */
  protected readonly statements = computed(() => {
    const d = this.data().data;
    if (!d) {
      return [];
    }
    const card = (item: AboutItem, fallback: IconName) => ({
      id: item.id,
      icon: asIcon(item.icon, fallback),
      title: item.title,
      body: item.body,
    });
    return [
      ...d.vision.map((v) => card(v, 'eye')),
      ...d.mission.map((m) => card(m, 'message-circle')),
    ];
  });

  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    { label: this.t.translate('shell.footer.about') },
  ]);

  private readonly seo = pageSeo();

  constructor() {
    effect(() => this.seo({ page: this.data().data?.page, path: '/about' }));
  }

  /** About-item bodies are sanitized HTML (C26); the feature card takes plain text. */
  protected readonly plain = plainText;
}
