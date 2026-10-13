import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../../core/i18n/locale.service';
import { governanceLinks } from '../../../core/site/governance';
import { SiteStore } from '../../../core/site/site.store';

/**
 * The governance pages' own navigation (ta3lom's section sub-nav, in the documents page's shape):
 * below lg a chip row that scrolls inside itself, from lg a sticky side list. Entries: the published
 * sections (`GET /documents/sections`), Licences and the board page. `active` is the current key.
 */
@Component({
  selector: 'app-governance-nav',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 lg:sticky lg:top-24' },
  template: `
    <!-- < lg: chip row. -->
    <nav
      class="-my-1 flex min-w-0 overflow-x-auto py-1 lg:hidden"
      [attr.aria-label]="'pages.governance.sections' | transloco"
    >
      <ul class="m-0 flex list-none gap-2.5 p-0">
        @for (l of links(); track l.key) {
          <li class="shrink-0">
            <a
              class="chip"
              [routerLink]="locale.link(l.path)"
              [attr.aria-current]="l.key === active() ? 'page' : null"
              >{{ l.label ?? (l.labelKey! | transloco) }}</a
            >
          </li>
        }
      </ul>
    </nav>

    <!-- lg+: side list. -->
    <nav class="hidden flex-col gap-2.5 lg:flex" aria-labelledby="governance-nav">
      <p class="t-eyebrow mb-1.5" id="governance-nav">
        {{ 'pages.governance.sections' | transloco }}
      </p>
      <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
        @for (l of links(); track l.key) {
          @let current = l.key === active();
          <li>
            <a
              class="tile flex min-h-11 items-center border no-underline"
              [class]="
                current
                  ? 'border-primary !bg-primary font-semibold text-on-primary'
                  : 'border-border !bg-card font-medium text-text hover:border-secondary'
              "
              [routerLink]="locale.link(l.path)"
              [attr.aria-current]="current ? 'page' : null"
              >{{ l.label ?? (l.labelKey! | transloco) }}</a
            >
          </li>
        }
      </ul>
    </nav>
  `,
})
export class GovernanceNav {
  /** Section slug, or `licences`. */
  readonly active = input.required<string>();
  protected readonly locale = inject(LocaleService);
  private readonly site = inject(SiteStore);
  protected readonly links = computed(() => governanceLinks(this.site.sections()));

  constructor() {
    // Below lg the current chip may sit off-screen at the end of the row: scroll the row (only).
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      const chip = host.querySelector<HTMLElement>('.chip[aria-current="page"]');
      const row = chip?.closest('nav');
      if (!chip || !row || row.scrollWidth <= row.clientWidth) return;
      const offset =
        chip.getBoundingClientRect().left -
        row.getBoundingClientRect().left -
        (row.clientWidth - chip.offsetWidth) / 2;
      row.scrollLeft += offset;
    });
  }
}
