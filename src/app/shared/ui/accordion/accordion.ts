import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * Disclosure row on native `<details>/<summary>`: works without JS (SSR, no-JS), keyboard and
 * screen-reader support come from the platform. `open` is two-way (`[(open)]`). Items sharing a
 * `name` are exclusive (only one open at a time, native behaviour).
 */
@Component({
  selector: 'app-accordion-item',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <details
      class="group card p-0 open:border-secondary"
      [attr.open]="open() ? '' : null"
      [attr.name]="name()"
      (toggle)="onToggle($event)"
    >
      <summary
        class="flex min-h-14 cursor-pointer list-none items-center gap-4 rounded-card px-5 py-3 font-semibold text-heading focus-visible:-outline-offset-4 md:px-6 [&::-webkit-details-marker]:hidden"
      >
        <span class="flex-1">{{ heading() }}</span>
        <app-icon
          name="chevron-down"
          class="text-secondary transition-transform duration-(--dur-hover-card) group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div class="px-5 pb-5 md:px-6 md:pb-6"><ng-content /></div>
    </details>
  `,
})
export class AccordionItem {
  readonly heading = input.required<string>();
  readonly open = model(false);
  /** Native exclusive group name (optional). */
  readonly name = input<string | null>(null);

  protected onToggle(event: Event): void {
    const isOpen = (event.target as HTMLDetailsElement).open;
    if (isOpen !== this.open()) {
      this.open.set(isOpen);
    }
  }
}

/** Vertical stack of accordion items with even spacing between rows. */
@Component({
  selector: 'app-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `<ng-content />`,
})
export class Accordion {}
