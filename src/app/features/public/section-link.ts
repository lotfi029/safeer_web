import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../core/i18n/locale.service';
import { appPathForApiUrl } from '../../core/site/nav-routes';
import { Button, type ButtonVariant } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';

export interface SectionTarget {
  href: string;
  external: boolean;
}

/**
 * Resolves an API button URL (locale-agnostic `/apply` after B9, legacy `#/x`, or external https)
 * to a target; internal paths get the current `/:lang` prefix. Unsafe URLs resolve to null.
 */
export function useSectionLink(): (url: string | null | undefined) => SectionTarget | null {
  const locale = inject(LocaleService);
  return (url) => {
    const target = appPathForApiUrl(url);
    if (!target) {
      return null;
    }
    return 'internal' in target
      ? { href: locale.link(target.internal), external: false }
      : { href: target.external, external: true };
  };
}

/**
 * A CMS button (label + URL from a page section). Renders nothing without a label or a safe URL.
 * `variant="text"` renders the prototype's "label →" text link.
 */
@Component({
  selector: 'app-section-button',
  imports: [RouterLink, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (label() && target(); as t) {
      @if (variant() === 'text') {
        @if (t.external) {
          <a
            class="inline-flex min-h-11 items-center gap-2 font-semibold"
            [href]="t.href"
            target="_blank"
            rel="noopener noreferrer"
            >{{ label() }} <app-icon name="arrow-right" [size]="18"
          /></a>
        } @else {
          <a class="inline-flex min-h-11 items-center gap-2 font-semibold" [routerLink]="t.href"
            >{{ label() }} <app-icon name="arrow-right" [size]="18"
          /></a>
        }
      } @else {
        @if (t.external) {
          <a
            appButton
            [variant]="buttonVariant()"
            [href]="t.href"
            target="_blank"
            rel="noopener noreferrer"
            >{{ label() }}</a
          >
        } @else {
          <a appButton [variant]="buttonVariant()" [routerLink]="t.href"
            >{{ label() }}
            @if (arrow()) {
              <app-icon name="arrow-right" [size]="19" />
            }
          </a>
        }
      }
    }
  `,
})
export class SectionButton {
  readonly label = input<string | null | undefined>(null);
  readonly url = input<string | null | undefined>(null);
  readonly variant = input<ButtonVariant | 'text'>('primary');
  readonly arrow = input(false);
  private readonly resolve = useSectionLink();
  protected readonly target = computed(() => this.resolve(this.url()));
  protected readonly buttonVariant = computed(
    () => (this.variant() === 'text' ? 'primary' : this.variant()) as ButtonVariant,
  );
}
