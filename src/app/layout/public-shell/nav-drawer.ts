import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { Icon } from '../../shared/ui/icon/icon';
import { Button } from '../../shared/ui/button/button';
import { DrawerFrame } from '../../shared/ui/drawer/drawer';
import { ShellNav } from './nav-links';

/**
 * Mobile/tablet navigation (< 1100px): full nav («الحوكمة» and «من نحن» as collapsible groups,
 * each open on one of its own pages) + contact CTA. The staff dashboard has no public link: it is
 * reached by URL only (/ar/admin, /en/admin).
 */
@Component({
  selector: 'app-nav-drawer',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, Button, DrawerFrame, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer-frame [heading]="'shell.menu' | transloco" headingId="nav-drawer-title">
      <nav [attr.aria-label]="'shell.mainNav' | transloco">
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          @for (item of nav.links(); track item.link) {
            <li>
              @if (nav.group(item.slug); as links) {
                <!-- W4: «الحوكمة» and «من نحن» as collapsible groups. -->
                <button
                  type="button"
                  class="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-btn px-3 text-start font-semibold text-text hover:bg-raise"
                  [attr.aria-controls]="'drawer-' + item.slug"
                  [attr.aria-expanded]="isOpen(item.slug)"
                  (click)="toggle(item.slug)"
                >
                  {{ item.label }}
                  <app-icon
                    name="chevron-down"
                    [size]="18"
                    [directional]="false"
                    class="transition-transform duration-200"
                    [class.rotate-180]="isOpen(item.slug)"
                  />
                </button>
                <ul
                  [id]="'drawer-' + item.slug"
                  class="m-0 ms-4 flex list-none flex-col gap-1 border-s-2 border-border ps-3"
                  [hidden]="!isOpen(item.slug)"
                >
                  @if (isOpen(item.slug)) {
                    @for (g of links; track g.key) {
                      <li>
                        <a
                          class="flex min-h-11 items-center rounded-btn px-3 font-medium text-text no-underline hover:bg-raise"
                          [routerLink]="locale.link(g.path)"
                          routerLinkActive="bg-secondary-light !text-heading"
                          [routerLinkActiveOptions]="{ exact: !!g.exact }"
                          ariaCurrentWhenActive="page"
                          (click)="close()"
                          >{{ g.label ?? (g.labelKey! | transloco) }}</a
                        >
                      </li>
                    }
                  }
                </ul>
              } @else {
                <a
                  class="flex min-h-12 items-center rounded-btn px-3 font-semibold text-text no-underline hover:bg-raise"
                  [routerLink]="item.link"
                  routerLinkActive="bg-secondary-light !text-heading"
                  [routerLinkActiveOptions]="{ exact: item.exact }"
                  ariaCurrentWhenActive="page"
                  (click)="close()"
                  >{{ item.label }}</a
                >
              }
            </li>
          }
        </ul>
      </nav>
      <a
        drawerActions
        appButton
        [block]="true"
        [routerLink]="locale.link('/contact')"
        (click)="close()"
        >{{ 'shell.contactCta' | transloco }}</a
      >
    </app-drawer-frame>
  `,
})
export class NavDrawer {
  protected readonly nav = inject(ShellNav);
  protected readonly locale = inject(LocaleService);
  private readonly ref = inject(DialogRef);
  private readonly url = inject(Router).url;
  /** The groups shown open: the one whose pages the drawer was opened on. */
  private readonly opened = signal<ReadonlySet<string>>(
    new Set(
      ['governance', 'about'].filter((section) =>
        new RegExp(`^/(ar|en)/${section}(/|$|\\?)`).test(this.url),
      ),
    ),
  );

  protected isOpen(slug: string): boolean {
    return this.opened().has(slug);
  }

  protected toggle(slug: string): void {
    this.opened.update((set) => {
      const next = new Set(set);
      if (!next.delete(slug)) next.add(slug);
      return next;
    });
  }

  protected close(): void {
    this.ref.close();
  }
}
