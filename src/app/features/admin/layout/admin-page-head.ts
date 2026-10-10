import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Page title row of a dashboard screen (prototype topbar title + subtitle + actions). Actions wrap
 * under the title on narrow screens: `<button pageActions …>`.
 */
@Component({
  selector: 'app-admin-page-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4' },
  template: `
    <div class="flex min-w-0 flex-col gap-1">
      <ng-content select="[pageBefore]" />
      <h1 class="t-h3 m-0 text-heading">{{ heading() }}</h1>
      @if (sub()) {
        <p class="t-small m-0 text-text-muted" data-testid="page-sub">{{ sub() }}</p>
      }
    </div>
    <div class="flex flex-wrap items-center gap-2 empty:hidden">
      <ng-content select="[pageActions]" />
    </div>
  `,
})
export class AdminPageHead {
  readonly heading = input.required<string>();
  readonly sub = input<string | null>(null);
}
