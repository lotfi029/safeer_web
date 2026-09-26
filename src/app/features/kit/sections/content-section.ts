import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Accordion, AccordionItem } from '../../../shared/ui/accordion/accordion';
import { ArcDivider } from '../../../shared/ui/arc-divider/arc-divider';
import { Card, FeatureCard } from '../../../shared/ui/card/card';
import { Counter } from '../../../shared/ui/counter/counter';
import { FlowingLines } from '../../../shared/ui/flowing-lines/flowing-lines';
import type { IconName } from '../../../shared/ui/icon/icon-names';
import { Brand, Logo } from '../../../shared/ui/logo/logo';
import { Breadcrumb, BreadcrumbItem } from '../../../shared/ui/page-head/breadcrumb';
import { PageHead } from '../../../shared/ui/page-head/page-head';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { SectionHeading } from '../../../shared/ui/section-heading/section-heading';

/** Copy from docs/safeer-design-spec.md §1 only; everything else is `[...]`. */
const ORG = 'جمعية سفير الدعوية';
const ABOUT =
  'جمعية أهلية غير ربحية متخصصة في رعاية طلاب وطالبات المنح الدوليين الدارسين في الجامعات السعودية.';

const AREAS: { icon: IconName; title: string }[] = [
  { icon: 'megaphone', title: 'الدعوة العامة' },
  { icon: 'globe', title: 'الدعوة الإلكترونية' },
  { icon: 'graduation-cap', title: 'التدريب والتأهيل' },
  { icon: 'book-open', title: 'الأبحاث والدراسات الدعوية' },
];

const PILLARS: { icon: IconName; title: string }[] = [
  { icon: 'book-open', title: 'الدعم الأكاديمي والتعليمي' },
  { icon: 'heart-handshake', title: 'الدعم النفسي والإرشادي' },
  { icon: 'lightbulb', title: 'الإرشاد الديني والدعوي' },
  { icon: 'users', title: 'التمكين والمشاركة المجتمعية' },
];

/** Kit: page head, breadcrumb, section headings, cards, accordion, counters, reveal, decor, logo. */
@Component({
  selector: 'app-kit-content-section',
  imports: [
    Accordion,
    AccordionItem,
    ArcDivider,
    Brand,
    Breadcrumb,
    Card,
    Counter,
    FeatureCard,
    FlowingLines,
    Logo,
    PageHead,
    Reveal,
    SectionHeading,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-12' },
  template: `
    <section aria-labelledby="kit-page-head" class="flex flex-col gap-4">
      <h2 id="kit-page-head" class="t-h4">PageHead / Breadcrumb</h2>
      <div class="overflow-hidden rounded-card">
        <app-page-head
          title="مجلس الإدارة"
          [lead]="about"
          [breadcrumb]="crumbs"
          [headingLevel]="2"
        />
      </div>
      <p class="t-caption">breadcrumb on a light background</p>
      <app-breadcrumb [items]="crumbs" />
    </section>

    <section aria-labelledby="kit-section-heading" class="flex flex-col gap-8">
      <h2 id="kit-section-heading" class="t-h4">SectionHeading</h2>
      <app-section-heading eyebrow="من نحن" [heading]="org" [lead]="about" [level]="3">
        <a headingAction href="#kit-section-heading" class="font-semibold">[...]</a>
      </app-section-heading>
      <app-section-heading eyebrow="[...]" heading="مجالات العمل" align="center" [level]="3" />
      <app-section-heading heading="level 2 · start · no eyebrow" />
    </section>

    <section aria-labelledby="kit-cards" class="flex flex-col gap-4">
      <h2 id="kit-cards" class="t-h4">Card</h2>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <app-card><p>default · [...]</p></app-card>
        <app-card hover><p>hover · [...]</p></app-card>
        <app-card flush>
          <div class="img-placeholder aspect-video rounded-none">[صورة: ...]</div>
          <p class="p-6">flush · [...]</p>
        </app-card>
        <app-card tone="surface"><p>surface · [...]</p></app-card>
        <app-card tone="band"><p>band · [...]</p></app-card>
      </div>
    </section>

    <section aria-labelledby="kit-feature-cards" class="flex flex-col gap-4">
      <h2 id="kit-feature-cards" class="t-h4">FeatureCard</h2>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        @for (a of areas; track a.title) {
          <app-feature-card [icon]="a.icon" [heading]="a.title" body="[...]">
            <a href="#kit-feature-cards" class="mt-auto font-semibold">[...]</a>
          </app-feature-card>
        }
      </div>
    </section>

    <section aria-labelledby="kit-accordion" class="flex flex-col gap-4">
      <h2 id="kit-accordion" class="t-h4">Accordion</h2>
      <app-accordion>
        <app-accordion-item heading="[سؤال ١] closed"><p>[...]</p></app-accordion-item>
        <app-accordion-item heading="[سؤال ٢] open" [(open)]="faqOpen"
          ><p>[...]</p></app-accordion-item
        >
        <app-accordion-item heading="[سؤال ٣]"><p>[...]</p></app-accordion-item>
      </app-accordion>
      <p class="t-caption">second item open: {{ faqOpen() }}</p>
    </section>

    <section aria-labelledby="kit-counters" class="flex flex-col gap-4">
      <h2 id="kit-counters" class="t-h4">Counter</h2>
      <div class="band grid gap-6 rounded-card p-8 sm:grid-cols-3">
        @for (s of stats; track $index) {
          <div class="flex flex-col gap-1">
            <app-counter class="t-h1" [value]="s.value" />
            <span class="t-small text-band-soft">{{ s.label }}</span>
          </div>
        }
      </div>
    </section>

    <section aria-labelledby="kit-reveal" class="flex flex-col gap-4">
      <h2 id="kit-reveal" class="t-h4">Reveal (scroll down; stagger 100ms)</h2>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        @for (p of pillars; track p.title; let i = $index) {
          <app-feature-card
            appReveal
            [revealIndex]="i"
            [icon]="p.icon"
            [heading]="p.title"
            body="[...]"
          />
        }
      </div>
    </section>

    <section aria-labelledby="kit-lines" class="flex flex-col gap-4">
      <h2 id="kit-lines" class="t-h4">FlowingLines / ArcDivider</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <div
          class="relative min-h-72 overflow-hidden rounded-card border border-border bg-hero p-8"
        >
          <app-flowing-lines [width]="420" [height]="300" />
          <p class="relative z-1">light</p>
        </div>
        <div class="band relative min-h-72 overflow-hidden rounded-card p-8">
          <app-flowing-lines tone="band" [width]="420" [height]="300" />
          <p class="relative z-1">band</p>
        </div>
      </div>
      <p class="t-caption">arc (opening down) · arc flipped (opening up) · on band</p>
      <app-arc-divider />
      <app-arc-divider flip />
      <div class="band rounded-card p-6"><app-arc-divider tone="band" /></div>
    </section>

    <section aria-labelledby="kit-logo" class="flex flex-col gap-4">
      <h2 id="kit-logo" class="t-h4">Logo / Brand</h2>
      <div class="flex flex-wrap items-end gap-4">
        <app-logo [height]="42" />
        <app-logo />
        <app-logo [height]="52" />
        <div class="band rounded-card p-4"><app-logo /></div>
      </div>
      <div class="flex flex-wrap items-center gap-8">
        <app-brand tagline="لطلاب المنح" />
        <app-brand compact />
      </div>
    </section>
  `,
})
export class KitContentSection {
  protected readonly org = ORG;
  protected readonly about = ABOUT;
  protected readonly areas = AREAS;
  protected readonly pillars = PILLARS;
  protected readonly faqOpen = signal(true);
  protected readonly crumbs: BreadcrumbItem[] = [
    { label: 'الرئيسية', link: '/' },
    { label: 'من نحن', link: '/' },
    { label: 'مجلس الإدارة' },
  ];
  /** Spec §1: the only real published figure is "٢ أعوام من الخبرة"; the rest are unknown. */
  protected readonly stats: { value: string | null; label: string }[] = [
    { value: '2', label: 'أعوام من الخبرة' },
    { value: null, label: '[...]' },
    { value: '500+', label: '[...] (demo)' },
  ];
}
