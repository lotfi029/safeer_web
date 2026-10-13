import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { governanceLinks } from '../../core/site/governance';
import { SiteStore } from '../../core/site/site.store';
import { Icon } from '../../shared/ui/icon/icon';
import { Button } from '../../shared/ui/button/button';
import { DrawerFrame } from '../../shared/ui/drawer/drawer';
import { ShellNav } from './nav-links';

/**
 * Mobile/tablet navigation (< 1100px): full nav (governance as a collapsible group, open on a
 * governance page) + staff link + contact CTA.
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
              @if (item.slug === 'governance') {
                <!-- W4: the governance pages as a collapsible group. -->
                <button
                  type="button"
                  class="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-btn px-3 text-start font-semibold text-text hover:bg-raise"
                  aria-controls="drawer-governance"
                  [attr.aria-expanded]="governanceOpen()"
                  (click)="governanceOpen.set(!governanceOpen())"
                >
                  {{ item.label }}
                  <app-icon
                    name="chevron-down"
                    [size]="18"
                    [directional]="false"
                    class="transition-transform duration-200"
                    [class.rotate-180]="governanceOpen()"
                  />
                </button>
                <ul
                  id="drawer-governance"
                  class="m-0 ms-4 flex list-none flex-col gap-1 border-s-2 border-border ps-3"
                  [hidden]="!governanceOpen()"
                >
                  @if (governanceOpen()) {
                    @for (g of governance(); track g.key) {
                      <li>
                        <a
                          class="flex min-h-11 items-center rounded-btn px-3 font-medium text-text no-underline hover:bg-raise"
                          [routerLink]="locale.link(g.path)"
                          routerLinkActive="bg-secondary-light !text-heading"
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
      <hr class="divider my-3" />
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li>
          <a
            class="flex min-h-12 items-center rounded-btn px-3 font-semibold text-text no-underline hover:bg-raise"
            [routerLink]="locale.link('/admin')"
            (click)="close()"
            >{{ 'shell.staff' | transloco }}</a
          >
        </li>
      </ul>
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
  private readonly site = inject(SiteStore);
  protected readonly governance = computed(() => governanceLinks(this.site.sections()));
  protected readonly governanceOpen = signal(
    /^\/(ar|en)\/governance(\/|$|\?)/.test(inject(Router).url),
  );

  protected close(): void {
    this.ref.close();
  }
}
