import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { Button } from '../../shared/ui/button/button';
import { DrawerFrame } from '../../shared/ui/drawer/drawer';
import { ShellNav } from './nav-links';

/** Mobile/tablet navigation (< 1100px): full nav + portal + staff links + apply CTA. */
@Component({
  selector: 'app-nav-drawer',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, Button, DrawerFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer-frame [heading]="'shell.menu' | transloco" headingId="nav-drawer-title">
      <nav [attr.aria-label]="'shell.mainNav' | transloco">
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          @for (item of nav.links(); track item.link) {
            <li>
              <a
                class="flex min-h-12 items-center rounded-btn px-3 font-semibold text-text no-underline hover:bg-raise"
                [routerLink]="item.link"
                routerLinkActive="bg-secondary-light !text-heading"
                [routerLinkActiveOptions]="{ exact: item.exact }"
                ariaCurrentWhenActive="page"
                (click)="close()"
                >{{ item.label }}</a
              >
            </li>
          }
        </ul>
      </nav>
      <hr class="divider my-3" />
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li>
          <a
            class="flex min-h-12 items-center rounded-btn px-3 font-semibold text-text no-underline hover:bg-raise"
            [routerLink]="locale.link('/portal')"
            (click)="close()"
            >{{ 'shell.portal' | transloco }}</a
          >
        </li>
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
        [routerLink]="locale.link('/apply')"
        (click)="close()"
        >{{ 'shell.apply' | transloco }}</a
      >
    </app-drawer-frame>
  `,
})
export class NavDrawer {
  protected readonly nav = inject(ShellNav);
  protected readonly locale = inject(LocaleService);
  private readonly ref = inject(DialogRef);

  protected close(): void {
    this.ref.close();
  }
}
