import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  inject,
  input,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

let nextId = 0;

/** A validation error as produced by Signal Forms (`kind` + optional `message`) or the API. */
export interface FieldErrorLike {
  kind: string;
  message?: string;
  [key: string]: unknown;
}

/** The part of a Signal Forms `FieldState` the field wrapper reads. */
export interface FieldStateLike {
  errors(): readonly FieldErrorLike[];
  touched(): boolean;
  invalid(): boolean;
  required?(): boolean;
}

/**
 * Label + hint + error wrapper for one control (plan §7: every field has a label and a linked error).
 * Works with Signal Forms: put `[formField]="form.email"` on the native control and pass the field
 * state as `[state]="form.email()"`. The projected control gets `appControl`, which wires `id`,
 * `aria-describedby`, `aria-invalid` and `aria-required` from this wrapper.
 *
 *   <app-field [label]="'…' | transloco" [state]="form.email()" hint="…">
 *     <input appControl type="email" [formField]="form.email" autocomplete="email" />
 *   </app-field>
 */
@Component({
  selector: 'app-field',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    <label class="field-label" [attr.for]="controlId">
      {{ label() }}
      @if (isRequired()) {
        <span class="field-required" aria-hidden="true">*</span>
      }
      @if (optional()) {
        <span class="t-caption font-normal">({{ 'common.optional' | transloco }})</span>
      }
    </label>
    <ng-content />
    @if (hint()) {
      <p class="field-hint" [id]="hintId">{{ hint() }}</p>
    }
    @if (showErrors()) {
      <p class="field-error" [id]="errorId" role="alert">
        @for (error of visibleErrors(); track $index) {
          <span class="block">{{ error.message || ('validation.' + error.kind | transloco: error) }}</span>
        }
      </p>
    }
  `,
})
export class Field {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly state = input<FieldStateLike | null>(null);
  /** Extra errors (e.g. server field errors from `ApiProblem.fieldErrors`). */
  readonly errors = input<readonly FieldErrorLike[]>([]);
  readonly required = input(false);
  readonly optional = input(false);
  /** Show errors before the control is touched (e.g. after a submit attempt). */
  readonly forceErrors = input(false);

  readonly controlId = `field-${++nextId}`;
  readonly hintId = `${this.controlId}-hint`;
  readonly errorId = `${this.controlId}-error`;

  readonly visibleErrors = computed(() => [...(this.state()?.errors() ?? []), ...this.errors()]);
  readonly showErrors = computed(
    () => this.visibleErrors().length > 0 && (this.forceErrors() || (this.state()?.touched() ?? true)),
  );
  readonly isRequired = computed(() => this.required() || (this.state()?.required?.() ?? false));
  readonly describedBy = computed(
    () => [this.hint() ? this.hintId : null, this.showErrors() ? this.errorId : null].filter(Boolean).join(' ') || null,
  );
}

/** Styles a native input/select/textarea and links it to the surrounding `<app-field>`. */
@Directive({
  selector: 'input[appControl], select[appControl], textarea[appControl]',
  host: {
    class: 'control',
    '[id]': 'field?.controlId ?? null',
    '[attr.aria-describedby]': 'field?.describedBy() ?? null',
    '[attr.aria-invalid]': 'field?.showErrors() ? "true" : null',
    '[attr.aria-required]': 'field?.isRequired() ? "true" : null',
  },
})
export class Control {
  protected readonly field = inject(Field, { optional: true });
}
