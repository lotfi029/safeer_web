import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Section heading (prototype `secHead`): eyebrow, h2/h3 and optional lead. A trailing link
 * (e.g. "كل الأخبار") goes in `[headingAction]`: at the inline end on md+, below on mobile.
 *
 *   <section aria-labelledby="news-h">
 *     <app-section-heading headingId="news-h" [eyebrow]="…" [heading]="…">
 *       <a headingAction …>…</a>
 *     </app-section-heading>
 */
@Component({
  selector: 'app-section-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-col gap-4',
    '[class.items-center]': 'align() === "center"',
    '[class.text-center]': 'align() === "center"',
    '[class.md:flex-row]': 'align() === "start"',
    '[class.md:items-end]': 'align() === "start"',
    '[class.md:justify-between]': 'align() === "start"',
  },
  template: `
    <div class="flex max-w-190 flex-col gap-3" [class.items-center]="align() === 'center'">
      @if (eyebrow()) {
        <p class="t-eyebrow">{{ eyebrow() }}</p>
      }
      @switch (level()) {
        @case (3) {
          <h3 class="t-h3" [attr.id]="headingId()">{{ heading() }}</h3>
        }
        @default {
          <h2 class="t-h2" [attr.id]="headingId()">{{ heading() }}</h2>
        }
      }
      @if (lead()) {
        <p class="t-lead">{{ lead() }}</p>
      }
    </div>
    <div class="shrink-0 empty:hidden"><ng-content select="[headingAction]" /></div>
  `,
})
export class SectionHeading {
  readonly heading = input.required<string>();
  readonly eyebrow = input<string | null>(null);
  readonly lead = input<string | null>(null);
  readonly level = input<2 | 3>(2);
  readonly align = input<'start' | 'center'>('start');
  /** id on the heading element, for the section's `aria-labelledby`. */
  readonly headingId = input<string | null>(null);
}
