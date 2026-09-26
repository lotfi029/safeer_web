import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FlowingLines } from '../flowing-lines/flowing-lines';
import { Breadcrumb, BreadcrumbItem } from './breadcrumb';

/**
 * Inner-page header (prototype `pageHead`): dark band with the flowing lines behind, breadcrumb,
 * the page `<h1>`, optional lead and projected actions.
 */
@Component({
  selector: 'app-page-head',
  imports: [Breadcrumb, FlowingLines],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'band relative block overflow-hidden py-12 md:py-16' },
  template: `
    <app-flowing-lines tone="band" [width]="420" [height]="300" />
    <div class="wrap relative z-1 flex flex-col gap-3">
      @if (breadcrumb().length) {
        <app-breadcrumb [items]="breadcrumb()" tone="band" />
      }
      @switch (headingLevel()) {
        @case (2) {
          <h2 class="t-h1" [attr.id]="headingId()">{{ title() }}</h2>
        }
        @default {
          <h1 class="t-h1" [attr.id]="headingId()">{{ title() }}</h1>
        }
      }
      @if (lead()) {
        <p class="t-lead max-w-185">{{ lead() }}</p>
      }
      <div class="mt-3 flex flex-wrap gap-3 empty:hidden"><ng-content /></div>
    </div>
  `,
})
export class PageHead {
  readonly title = input.required<string>();
  readonly lead = input<string | null>(null);
  readonly breadcrumb = input<readonly BreadcrumbItem[]>([]);
  /** 1 on real pages; 2 only where the page already has an h1 (e.g. the kit). */
  readonly headingLevel = input<1 | 2>(1);
  readonly headingId = input<string | null>(null);
}
