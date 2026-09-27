import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { SiteStore } from '../../core/site/site.store';
import { Button } from '../../shared/ui/button/button';
import { DrawerService } from '../../shared/ui/drawer/drawer';
import { Icon } from '../../shared/ui/icon/icon';
import { Brand } from '../../shared/ui/logo/logo';
import { LangSwitch } from './lang-switch';
import { NavDrawer } from './nav-drawer';
import { ShellNav } from './nav-links';
import { ThemeToggle } from './theme-toggle';

/**
 * Sticky site header (prototype `siteNav`): brand, full nav from ≥1100px (F7 `nav` breakpoint),
 * language + theme, portal link (≥1280), apply CTA (≥768), burger → drawer below 1100px.
 */
@Component({
  selector: 'app-site-header',
  imports: [
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    Button,
    Icon,
    Brand,
    LangSwitch,
    ThemeToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sticky top-0 z-50 block border-b border-border bg-bg transition-shadow duration-200',
    '[class.shadow-[var(--shadow-sm)]]': 'stuck()',
  },
  template: `
    <header class="mx-auto flex h-17 max-w-[1400px] items-center gap-2 px-(--pad) md:h-22 md:gap-4">
      <a
        class="flex min-w-0 items-center text-heading no-underline"
        [routerLink]="locale.link('/')"
        [attr.aria-label]="'shell.home' | transloco"
      >
        <app-brand
          [name]="site.site()?.settings?.orgName ?? null"
          [tagline]="site.site()?.settings?.tagline ?? null"
          priority
        />
      </a>

      <nav
        class="hidden grow justify-center nav:flex"
        [attr.aria-label]="'shell.mainNav' | transloco"
      >
        <ul class="m-0 flex list-none items-center gap-3 p-0 xl:gap-5">
          @for (item of nav.headerLinks(); track item.link) {
            <li>
              <a
                class="block border-b-2 border-transparent py-2 text-[15px] font-medium whitespace-nowrap text-text no-underline hover:text-secondary"
                [routerLink]="item.link"
                routerLinkActive="!border-secondary !font-semibold !text-heading"
                [routerLinkActiveOptions]="{ exact: item.exact }"
                ariaCurrentWhenActive="page"
                >{{ item.shortLabel }}</a
              >
            </li>
          }
        </ul>
      </nav>

      <div class="ms-auto flex items-center gap-2 md:gap-3 nav:ms-0">
        @if (site.site()?.settings?.enEnabled !== false) {
          <app-lang-switch />
        }
        <app-theme-toggle />
        <a
          class="hidden text-[15px] font-semibold whitespace-nowrap text-heading no-underline hover:text-secondary xl:inline"
          [routerLink]="locale.link('/portal')"
          >{{ 'shell.portal' | transloco }}</a
        >
        <a
          appButton
          size="sm"
          class="hidden whitespace-nowrap md:inline-flex"
          [routerLink]="locale.link('/apply')"
          >{{ 'shell.applyShort' | transloco }}</a
        >
        <button
          type="button"
          class="icon-btn nav:hidden"
          [attr.aria-label]="'shell.openMenu' | transloco"
          aria-haspopup="dialog"
          (click)="openMenu()"
        >
          <app-icon name="menu" />
        </button>
      </div>
    </header>
  `,
})
export class SiteHeader {
  protected readonly locale = inject(LocaleService);
  protected readonly site = inject(SiteStore);
  protected readonly nav = inject(ShellNav);
  private readonly drawer = inject(DrawerService);
  protected readonly stuck = signal(false);

  constructor() {
    const document = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const win = document.defaultView;
      if (!win) {
        return;
      }
      const onScroll = () => this.stuck.set(win.scrollY > 8);
      win.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      destroyRef.onDestroy(() => win.removeEventListener('scroll', onScroll));
    });
  }

  protected openMenu(): void {
    this.drawer.open(NavDrawer, { side: 'end', ariaLabelledBy: 'nav-drawer-title' });
  }
}
