import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { LocaleService } from '../../core/i18n/locale.service';
import type { NavMenuLink } from '../../core/site/about';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * A header dropdown (≥1100px) — «الحوكمة» (sections, licences, board) and «من نحن» (about,
 * organisational structure): a disclosure button that shows its links. The links are always in the
 * SSR HTML (hidden until opened), so crawlers see them. Closes on Escape (focus back on the button),
 * on a click outside, when focus leaves it and after navigating.
 */
@Component({
  selector: 'app-nav-menu',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    '(keydown.escape)': 'closeAndFocus()',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    <button
      #toggle
      type="button"
      class="flex cursor-pointer items-center gap-1 border-b-2 py-2 text-[15px] whitespace-nowrap no-underline hover:text-secondary"
      [class]="
        active()
          ? 'border-secondary font-semibold text-heading'
          : 'border-transparent font-medium text-text'
      "
      [attr.aria-controls]="menuId()"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    >
      {{ label() }}
      <app-icon
        name="chevron-down"
        [size]="16"
        [directional]="false"
        class="transition-transform duration-200"
        [class.rotate-180]="open()"
      />
    </button>
    <div
      [id]="menuId()"
      class="absolute start-0 top-full z-50 mt-2 w-72 rounded-card border border-border bg-card p-2 shadow-[var(--shadow-md)]"
      [hidden]="!open()"
    >
      <ul class="m-0 flex list-none flex-col p-0" [attr.aria-label]="label()">
        @for (l of links(); track l.key) {
          <li>
            <a
              class="flex min-h-11 items-center rounded-btn px-3 text-[15px] font-medium text-text no-underline hover:bg-raise"
              [routerLink]="locale.link(l.path)"
              routerLinkActive="bg-secondary-light font-semibold !text-heading"
              [routerLinkActiveOptions]="{ exact: !!l.exact }"
              ariaCurrentWhenActive="page"
              (click)="open.set(false)"
              >{{ l.label ?? (l.labelKey! | transloco) }}</a
            >
          </li>
        }
      </ul>
    </div>
  `,
})
export class NavMenu {
  /** The nav label (the API's short label for this entry). */
  readonly label = input.required<string>();
  /** The first path segment the menu's pages share (`governance`, `about`): marks the entry active. */
  readonly section = input.required<string>();
  readonly links = input.required<readonly NavMenuLink[]>();

  protected readonly locale = inject(LocaleService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');
  protected readonly open = signal(false);
  protected readonly menuId = computed(() => `${this.section()}-menu`);

  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: inject(Router).url },
  );
  /** On one of the menu's pages: the entry is marked like the other active header links. */
  protected readonly active = computed(() =>
    new RegExp(`^/(ar|en)/${this.section()}(/|$|\\?)`).test(this.url()),
  );

  constructor() {
    const doc = inject(DOCUMENT);
    const onClick = (event: MouseEvent) => {
      if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
        this.open.set(false);
      }
    };
    doc.addEventListener('click', onClick);
    inject(DestroyRef).onDestroy(() => doc.removeEventListener('click', onClick));
  }

  protected closeAndFocus(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.toggle().nativeElement.focus();
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && !this.host.nativeElement.contains(next)) this.open.set(false);
  }
}
