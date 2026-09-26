import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DigitsPipe } from '../../pipes/format';
import { Icon } from '../icon/icon';
import { Progress } from '../progress/progress';

export interface StepperStep {
  label: string;
}

/**
 * Form wizard progress. md+ : horizontal `<ol>` with numbered circles. Below md: compact
 * "الخطوة ٢ من ٣" + current label + progress bar. Both are rendered and toggled with Tailwind
 * responsive classes (display:none hides the inactive one from AT too) so SSR output is correct
 * at every width without measuring the viewport.
 *
 * A step is "done" when its index is in `completed`, or (when `completed` is omitted) when it is
 * before `current`.
 */
@Component({
  selector: 'app-stepper',
  imports: [TranslocoPipe, DigitsPipe, Icon, Progress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ol
      class="m-0 hidden list-none items-center gap-2 p-0 md:flex"
      [attr.aria-label]="'ui.stepper.label' | transloco"
    >
      @for (step of steps(); track $index; let i = $index; let last = $last) {
        <li
          class="flex min-w-0 grow items-center gap-3"
          [attr.aria-current]="i === current() ? 'step' : null"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-full border-2 font-bold"
            [class]="circleClass(i)"
          >
            @if (isDone(i)) {
              <app-icon name="check" [size]="18" />
            } @else {
              <span aria-hidden="true">{{ i + 1 | digits }}</span>
            }
          </span>
          <span
            class="min-w-0 text-sm"
            [class.font-semibold]="i === current()"
            [class.text-heading]="i === current()"
          >
            @if (!isDone(i)) {
              <span class="sr-only">{{ i + 1 | digits }}.</span>
            }
            {{ step.label }}
            @if (isDone(i)) {
              <span class="sr-only">({{ 'ui.stepper.done' | transloco }})</span>
            } @else if (i === current()) {
              <span class="sr-only">({{ 'ui.stepper.current' | transloco }})</span>
            }
          </span>
          @if (!last) {
            <span
              class="h-0.5 min-w-4 grow rounded-full"
              [class]="isDone(i) ? 'bg-primary' : 'bg-border'"
              aria-hidden="true"
            ></span>
          }
        </li>
      }
    </ol>

    <div class="flex flex-col gap-2 md:hidden">
      <p class="t-caption m-0 font-semibold">
        {{
          'ui.stepper.compact'
            | transloco: { current: (current() + 1 | digits), total: (steps().length | digits) }
        }}
      </p>
      <p class="m-0 font-bold text-heading" aria-current="step">{{ steps()[current()]?.label }}</p>
      <app-progress [value]="percent()" [label]="'ui.stepper.label' | transloco" />
    </div>
  `,
})
export class Stepper {
  readonly steps = input.required<readonly StepperStep[]>();
  /** 0-based index of the current step. */
  readonly current = input(0);
  readonly completed = input<readonly number[] | null>(null);

  protected readonly percent = computed(() => {
    const total = this.steps().length;
    return total ? ((this.current() + 1) / total) * 100 : 0;
  });

  protected isDone(i: number): boolean {
    const completed = this.completed();
    return completed ? completed.includes(i) && i !== this.current() : i < this.current();
  }

  protected circleClass(i: number): string {
    if (this.isDone(i)) {
      return 'border-primary bg-primary text-on-primary';
    }
    return i === this.current()
      ? 'border-secondary bg-secondary-light text-heading'
      : 'border-border bg-card text-text-muted';
  }
}
