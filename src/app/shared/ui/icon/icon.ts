import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { IconName } from './icon-names';

/** Directional icons that should point the reading direction (mirrored in RTL). */
const DIRECTIONAL: ReadonlySet<IconName> = new Set<IconName>([
  'arrow-left',
  'arrow-right',
  'chevron-left',
  'chevron-right',
  'log-out',
  'log-in',
  'send',
]);

/**
 * Line icon from the Lucide sprite (`public/icons.svg`, 1.75px stroke). Decorative by default
 * (`aria-hidden`); pass `label` only when the icon alone carries meaning. Icon-only buttons put
 * their `aria-label` on the button, not here.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0',
    '[class.flip-rtl]': 'flip()',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label()',
  },
  template: `<svg [attr.width]="size()" [attr.height]="size()" focusable="false">
    <use [attr.href]="href()" />
  </svg>`,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly label = input<string | null>(null);
  /** Set to false for arrows that must keep a physical direction (e.g. "up"). */
  readonly directional = input(true);

  protected readonly href = computed(() => `/icons.svg#${this.name()}`);
  protected readonly flip = computed(() => this.directional() && DIRECTIONAL.has(this.name()));
}
