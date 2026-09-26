import { Directive, input } from '@angular/core';

export type ButtonVariant =
  | 'primary'
  | 'ghost'
  | 'soft'
  | 'line'
  | 'danger'
  | 'onband'
  | 'onband-ghost'
  | 'link';

/**
 * Styles a real `<button>` or `<a>` as a spec button (52–54px, radius 10, hover lift 1px / 200ms).
 * Keeping the native element preserves semantics, focus and keyboard behaviour (hard rule 5).
 *
 *   <button appButton variant="ghost" size="sm" type="button">…</button>
 *   <a appButton [routerLink]="…">…</a>
 */
@Directive({
  selector: 'button[appButton], a[appButton]',
  host: {
    class: 'btn',
    '[class.btn-ghost]': 'variant() === "ghost"',
    '[class.btn-soft]': 'variant() === "soft"',
    '[class.btn-line]': 'variant() === "line"',
    '[class.btn-danger]': 'variant() === "danger"',
    '[class.btn-onband]': 'variant() === "onband"',
    '[class.btn-onband-ghost]': 'variant() === "onband-ghost"',
    '[class.btn-link]': 'variant() === "link"',
    '[class.btn-sm]': 'size() === "sm"',
    '[class.btn-block]': 'block()',
    '[attr.aria-busy]': 'busy() ? "true" : null',
  },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<'md' | 'sm'>('md');
  readonly block = input(false);
  readonly busy = input(false);
}

/**
 * Square 44×44 icon-only button. `aria-label` is required (hard rule 5) and enforced at runtime in
 * dev by the input being required.
 */
@Directive({
  selector: 'button[appIconButton], a[appIconButton]',
  host: { class: 'icon-btn', '[attr.aria-label]': 'label()' },
})
export class IconButton {
  readonly label = input.required<string>({ alias: 'appIconButton' });
}
