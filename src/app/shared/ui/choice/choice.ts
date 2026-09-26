import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/**
 * Group of native radio cards / checkboxes with a visible legend (fieldset keeps the group name
 * for screen readers). Options are native inputs wrapped in `<label class="choice">` (radio card)
 * or `<label class="check">` (checkbox) and projected; there is no custom radio component.
 * Signal Forms: bind each radio with `[formField]="form.field"` and a `value`.
 *
 *   <app-choice-group [legend]="…" [columns]="2">
 *     <label class="choice"><input type="radio" name="gender" value="m" [formField]="f.gender" /> …</label>
 *     <label class="choice"><input type="radio" name="gender" value="f" [formField]="f.gender" /> …</label>
 *   </app-choice-group>
 */
@Component({
  selector: 'app-choice-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="m-0 flex flex-col gap-3 border-0 p-0" [attr.aria-describedby]="describedBy()">
      <legend class="field-label mb-3 p-0">
        {{ legend() }}
        @if (required()) {
          <span class="field-required" aria-hidden="true">*</span>
        }
      </legend>
      <div class="grid gap-3" [class.sm:grid-cols-2]="columns() === 2" [class.sm:grid-cols-3]="columns() === 3">
        <ng-content />
      </div>
      @if (hint()) {
        <p class="field-hint" [id]="hintId">{{ hint() }}</p>
      }
      @if (error()) {
        <p class="field-error" [id]="errorId" role="alert">{{ error() }}</p>
      }
    </fieldset>
  `,
})
export class ChoiceGroup {
  readonly legend = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly required = input(false);
  /** Grid columns from `sm` up (always 1 column below 480px). */
  readonly columns = input<1 | 2 | 3>(1);

  private readonly id = `choice-${++nextId}`;
  protected readonly hintId = `${this.id}-hint`;
  protected readonly errorId = `${this.id}-error`;

  protected describedBy(): string | null {
    return [this.hint() ? this.hintId : null, this.error() ? this.errorId : null].filter(Boolean).join(' ') || null;
  }
}
