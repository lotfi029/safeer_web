import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { StaffSessionStore } from '../../../core/auth/staff-session.store';
import { LocaleService } from '../../../core/i18n/locale.service';
import { LangSwitch } from '../../../layout/public-shell/lang-switch';
import { ThemeToggle } from '../../../layout/public-shell/theme-toggle';
import { DigitsPipe } from '../../../shared/pipes/format';
import { Button, IconButton } from '../../../shared/ui/button/button';
import { DrawerFrame, DrawerService } from '../../../shared/ui/drawer/drawer';
import { Icon } from '../../../shared/ui/icon/icon';
import { Logo } from '../../../shared/ui/logo/logo';
import { ToastOutlet } from '../../../shared/ui/toast/toast';
import { AdminBadges } from './admin-badges';
import { AdminNav } from './admin-nav';

/**
 * The menu itself, shared by the sidebar (`rail` below xl: icons only, names as tooltips and
 * visually hidden text) and the drawer used below lg.
 */
@Component({
  selector: 'app-admin-nav-list',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, DigitsPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (group of nav.groups(); track group.label) {
      <p
        class="m-0 px-3 pt-5 pb-2 text-xs font-semibold tracking-wider"
        [class]="dark() ? 'text-sidebar-muted' : 'text-text-muted'"
        [class.lg:max-xl:sr-only]="dark()"
      >
        {{ 'admin.shell.groups.' + group.label | transloco }}
      </p>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        @for (item of group.items; track item.path) {
          <li>
            <a
              class="relative flex min-h-12 items-center gap-3 rounded-btn px-3 font-medium no-underline"
              [class]="
                dark()
                  ? 'text-sidebar-text hover:bg-sidebar-hover lg:max-xl:justify-center'
                  : 'text-text hover:bg-raise'
              "
              [routerLink]="item.link"
              [routerLinkActive]="
                dark()
                  ? '!bg-sidebar-active !text-sidebar-active-text font-semibold'
                  : 'bg-secondary-light !text-heading font-semibold'
              "
              [routerLinkActiveOptions]="{ exact: !!item.exact }"
              ariaCurrentWhenActive="page"
              [attr.title]="dark() ? ('admin.shell.items.' + item.label | transloco) : null"
            >
              <app-icon [name]="item.icon" [size]="20" class="shrink-0" />
              <span [class.lg:max-xl:sr-only]="dark()">{{
                'admin.shell.items.' + item.label | transloco
              }}</span>
              @if (item.count > 0) {
                <span
                  class="ms-auto rounded-full px-2 py-0.5 text-xs font-bold"
                  [class]="
                    item.badge === 'newApplications'
                      ? 'bg-alert text-on-primary'
                      : 'bg-secondary text-on-primary'
                  "
                  [class.lg:max-xl:absolute]="dark()"
                  [class.lg:max-xl:-top-1]="dark()"
                  [class.lg:max-xl:end-1]="dark()"
                >
                  {{ item.count | digits }}
                  <span class="sr-only">{{
                    'admin.shell.badge' | transloco: { count: (item.count | digits) }
                  }}</span>
                </span>
              }
            </a>
          </li>
        }
      </ul>
    }
  `,
})
export class AdminNavList {
  protected readonly nav = inject(AdminNav);
  /** Sidebar styling (dark surface, rail below xl) vs drawer styling. */
  readonly dark = input(false);
}

/** Below lg: the same menu in an end-side drawer. */
@Component({
  selector: 'app-admin-nav-drawer',
  imports: [TranslocoPipe, DrawerFrame, AdminNavList, Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer-frame [heading]="'admin.shell.dashboard' | transloco" headingId="admin-nav-title">
      <nav [attr.aria-label]="'admin.shell.nav' | transloco">
        <app-admin-nav-list />
      </nav>
      <a drawerActions appButton variant="line" [block]="true" [routerLink]="locale.link('/')">
        {{ 'admin.shell.viewSite' | transloco }}
      </a>
    </app-drawer-frame>
  `,
  host: { '(click)': 'onClick($event)' },
})
export class AdminNavDrawer {
  protected readonly locale = inject(LocaleService);
  private readonly ref = inject(DialogRef);

  /** Close after following any link in the drawer. */
  protected onClick(event: Event): void {
    if ((event.target as HTMLElement).closest('a[href]')) {
      this.ref.close();
    }
  }
}

/**
 * Dashboard chrome (prototype `adminShell`): the sidebar at xl+, an icon rail at lg, and a drawer
 * below lg; a top bar with language, theme, "view site" and the signed-in staff member. Menu items
 * come from `GET /admin/roles` (AdminNav), badges from `GET /admin/overview` (AdminBadges).
 */
@Component({
  selector: 'app-admin-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    TranslocoPipe,
    LangSwitch,
    ThemeToggle,
    Button,
    IconButton,
    Icon,
    Logo,
    ToastOutlet,
    AdminNavList,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh bg-app-bg' },
  template: `
    <a
      class="sr-only z-[60] rounded-btn bg-primary px-4 py-3 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      href="#main"
      >{{ 'common.skipToContent' | transloco }}</a
    >
    <aside
      class="sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto bg-sidebar px-3 pt-5 pb-6 lg:flex lg:w-22 xl:w-72"
      data-testid="admin-sidebar"
    >
      <a
        class="flex items-center gap-3 px-1 pb-2 text-sidebar-text no-underline lg:max-xl:justify-center"
        [routerLink]="locale.link('/admin')"
      >
        <app-logo [height]="48" alt="" />
        <span class="flex flex-col lg:max-xl:sr-only">
          <b class="text-base text-on-primary">{{ 'admin.shell.dashboard' | transloco }}</b>
          <span class="text-xs text-sidebar-muted">{{ 'common.orgName' | transloco }}</span>
        </span>
      </a>
      <nav [attr.aria-label]="'admin.shell.nav' | transloco">
        <app-admin-nav-list [dark]="true" />
      </nav>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-30 border-b border-border bg-card">
        <div class="flex min-h-16 flex-wrap items-center gap-2 px-4 py-2 md:px-6 xl:px-9">
          <button
            class="lg:hidden"
            [appIconButton]="'admin.shell.openMenu' | transloco"
            type="button"
            aria-haspopup="dialog"
            (click)="openMenu()"
          >
            <app-icon name="menu" />
          </button>
          <a
            class="flex items-center gap-2 no-underline lg:hidden"
            [routerLink]="locale.link('/admin')"
          >
            <app-logo [height]="40" alt="" />
            <span class="sr-only sm:not-sr-only sm:font-bold sm:text-heading">{{
              'admin.shell.dashboard' | transloco
            }}</span>
          </a>
          <span class="grow"></span>
          <app-lang-switch />
          <app-theme-toggle />
          <a
            appButton
            variant="line"
            size="sm"
            class="hidden md:inline-flex"
            [routerLink]="locale.link('/')"
            >{{ 'admin.shell.viewSite' | transloco }}</a
          >
          @if (me(); as user) {
            <span
              class="hidden items-center gap-2 rounded-full bg-secondary-light py-1.5 ps-1.5 pe-4 font-semibold text-heading sm:inline-flex"
              data-testid="admin-user"
            >
              <span
                class="grid size-8 place-items-center rounded-full bg-primary text-sm text-on-primary"
                aria-hidden="true"
              >
                @if (initial(); as i) {
                  {{ i }}
                } @else {
                  <app-icon name="user" [size]="16" />
                }
              </span>
              <span class="flex flex-col leading-tight">
                <span class="max-w-44 truncate text-sm">{{ user.name }}</span>
                <span class="text-xs font-medium text-text-muted">{{
                  'admin.shell.roles.' + user.role | transloco
                }}</span>
              </span>
            </span>
          }
          <button [appIconButton]="'admin.logout' | transloco" type="button" (click)="logout()">
            <app-icon name="log-out" />
          </button>
        </div>
      </header>
      <main id="main" class="flex-1 px-4 py-6 md:px-6 xl:px-9 xl:py-8" tabindex="-1">
        <router-outlet />
      </main>
    </div>
    <app-toast-outlet />
  `,
})
export class AdminShell {
  protected readonly locale = inject(LocaleService);
  private readonly store = inject(StaffSessionStore);
  private readonly badges = inject(AdminBadges);
  private readonly router = inject(Router);
  private readonly drawer = inject(DrawerService);

  protected readonly me = this.store.me;
  /** First letter of the name; placeholder names like "[…]" get an icon instead. */
  protected readonly initial = computed(() => {
    const first = this.me()?.name?.trim()[0] ?? '';
    return /\p{L}/u.test(first) ? first : null;
  });

  constructor() {
    void this.badges.refresh();
    let last = Date.now();
    // Keep the badges roughly current as staff move around (at most once a minute).
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (Date.now() - last > 60_000) {
          last = Date.now();
          void this.badges.refresh();
        }
      });
  }

  protected openMenu(): void {
    this.drawer.open(AdminNavDrawer, { ariaLabelledBy: 'admin-nav-title' });
  }

  protected async logout(): Promise<void> {
    await this.store.logout().catch(() => undefined);
    this.badges.clear();
    await this.router.navigateByUrl(this.locale.link('/admin/login'));
  }
}
