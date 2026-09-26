import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  viewChildren,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';

/** Keep only ASCII digits; Arabic-Indic / Persian digits are normalised first (users may type them). */
export function onlyDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
}

/**
 * One-time-code input: `length` single-digit boxes, a Signal Forms custom control
 * (`FormValueControl<string>`), so `<app-otp-input [formField]="form.code" />` just works.
 *
 * Direction: the group is rendered with `dir="ltr"` even in Arabic. A code is a number read
 * left-to-right (like phone numbers, which we also keep LTR), and SMS shows it that way; an RTL row
 * would put the first digit on the right and reverse what users copy from the message. Because the
 * row is always LTR, ArrowLeft = previous box and ArrowRight = next box in both languages.
 *
 * The first box carries `autocomplete="one-time-code"` and accepts the full code (maxlength =
 * length) so iOS/Android SMS autofill is not truncated; the input handler spreads it across the
 * boxes. Other boxes are maxlength 1.
 */
@Component({
  selector: 'app-otp-input',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(focusout)': 'onFocusOut($event)' },
  template: `
    <div
      role="group"
      dir="ltr"
      class="flex justify-center gap-2 sm:gap-3"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-label]="labelledBy() ? null : (label() ?? ('ui.otp.label' | transloco))"
      [attr.aria-describedby]="describedBy()"
    >
      @for (cell of cells(); track $index; let i = $index) {
        <input
          #box
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          class="control w-11 px-0 text-center text-xl font-bold sm:w-13"
          [attr.maxlength]="i === 0 ? length() : 1"
          [attr.autocomplete]="i === 0 ? 'one-time-code' : 'off'"
          [attr.name]="i === 0 ? name() : null"
          [attr.aria-label]="'ui.otp.digit' | transloco: { n: i + 1, total: length() }"
          [attr.aria-invalid]="showInvalid() ? 'true' : null"
          [value]="cell"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          (input)="onInput(i, $event)"
          (keydown)="onKeydown(i, $event)"
          (paste)="onPaste(i, $event)"
          (focus)="select(i)"
        />
      }
    </div>
  `,
})
export class OtpInput implements FormValueControl<string> {
  readonly value = model('');
  readonly length = input(6);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  /**
   * Invalid styling shows only once touched (Signal Forms binds both; `invalid` is true for an
   * empty required code from the start). Standalone use: pass `[invalid]` and `[touched]="true"`.
   */
  readonly touched = input(false);
  readonly name = input('');
  /** Accessible name (translated). Defaults to 'ui.otp.label'. Ignored when `labelledBy` is set. */
  readonly label = input<string | null>(null);
  /** id of a visible label element. */
  readonly labelledBy = input<string | null>(null);
  /** id(s) of hint / error text. */
  readonly describedBy = input<string | null>(null);

  /** Emits the full code once every box is filled by the user. */
  readonly completed = output<string>();
  /** Signal Forms: marks the field touched when focus leaves the whole group. */
  readonly touch = output<void>();

  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Per-box digits. Follows `value`, but keeps gaps while the user edits a middle box. */
  protected readonly cells = linkedSignal<{ value: string; length: number }, string[]>({
    source: () => ({ value: this.value(), length: this.length() }),
    computation: ({ value, length }, previous) => {
      if (previous && previous.value.length === length && previous.value.join('') === value) {
        return previous.value;
      }
      const digits = onlyDigits(value ?? '').slice(0, length);
      return Array.from({ length }, (_, i) => digits[i] ?? '');
    },
  });

  protected readonly showInvalid = computed(() => this.invalid() && this.touched());

  /** Focuses the first empty box (used by Signal Forms `focus()` on submit errors). */
  focus(options?: FocusOptions): void {
    const index = this.cells().findIndex((c) => c === '');
    this.focusBox(index === -1 ? this.length() - 1 : index, options);
  }

  protected onInput(i: number, event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = onlyDigits(el.value);
    if (digits.length > 1) {
      this.fill(digits, digits.length >= this.length() ? 0 : i);
      el.value = this.cells()[i];
      return;
    }
    this.setCell(i, digits);
    el.value = digits;
    if (digits) {
      this.focusBox(i + 1);
    }
  }

  protected onKeydown(i: number, event: KeyboardEvent): void {
    switch (event.key) {
      case 'Backspace':
        if (!this.cells()[i] && i > 0) {
          event.preventDefault();
          this.setCell(i - 1, '');
          this.focusBox(i - 1);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.focusBox(i - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.focusBox(i + 1);
        break;
      case 'Home':
        event.preventDefault();
        this.focusBox(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusBox(this.length() - 1);
        break;
    }
  }

  protected onPaste(i: number, event: ClipboardEvent): void {
    const digits = onlyDigits(event.clipboardData?.getData('text') ?? '');
    event.preventDefault();
    if (digits) {
      this.fill(digits, digits.length >= this.length() ? 0 : i);
    }
  }

  protected select(i: number): void {
    this.boxes()[i]?.nativeElement.select();
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.host.nativeElement.contains(next)) {
      this.touch.emit();
    }
  }

  private fill(digits: string, start: number): void {
    const cells = [...this.cells()];
    let index = start;
    for (const d of digits) {
      if (index >= cells.length) {
        break;
      }
      cells[index++] = d;
    }
    this.commit(cells);
    const firstEmpty = cells.findIndex((c) => c === '');
    this.focusBox(firstEmpty === -1 ? cells.length - 1 : firstEmpty);
  }

  private setCell(i: number, digit: string): void {
    const cells = [...this.cells()];
    cells[i] = digit;
    this.commit(cells);
  }

  private commit(cells: string[]): void {
    this.cells.set(cells);
    const code = cells.join('');
    this.value.set(code);
    if (cells.every((c) => c !== '')) {
      this.completed.emit(code);
    }
  }

  private focusBox(i: number, options?: FocusOptions): void {
    const boxes = this.boxes();
    if (i >= 0 && i < boxes.length) {
      boxes[i].nativeElement.focus(options);
    }
  }
}
