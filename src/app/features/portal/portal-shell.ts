import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApplicantSessionStore } from '../../core/auth/applicant-session.store';
import { LocaleService } from '../../core/i18n/locale.service';
import { LangSwitch } from '../../layout/public-shell/lang-switch';
import { ThemeToggle } from '../../layout/public-shell/theme-toggle';
import { IconButton } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';
import { Logo } from '../../shared/ui/logo/logo';
import { ToastOutlet } from '../../shared/ui/toast/toast';

/**
 * Portal chrome (prototype `portalNav`): brand, status / documents / support links, language and
 * theme, the student's name and sign-out. Below `md` the links move to a second row that scrolls.
 */
@Component({
  selector: 'app-portal-shell',
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    LangSwitch,
    ThemeToggle,
    IconButton,
    Icon,
    Logo,
    ToastOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col bg-surface' },
  template: `
    <a
      class="sr-only z-[60] rounded-btn bg-primary px-4 py-3 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      href="#main"
      >{{ 'common.skipToContent' | transloco }}</a
    >
    <header class="sticky top-0 z-30 border-b border-border bg-card">
      <div class="wrap flex min-h-17 items-center gap-4 py-2 md:min-h-22">
        <a class="flex items-center gap-3 no-underline" [routerLink]="locale.link('/portal')">
          <app-logo [height]="44" />
          <strong class="text-lg text-heading">{{ 'portal.title' | transloco }}</strong>
        </a>
        <nav class="mx-auto hidden md:block" [attr.aria-label]="'portal.nav.label' | transloco">
          <ng-container *ngTemplateOutlet="links" />
        </nav>
        <div class="ms-auto flex items-center gap-2 md:ms-0">
          <app-lang-switch />
          <app-theme-toggle />
          @if (name(); as n) {
            <span
              class="hidden items-center gap-2 rounded-full bg-secondary-light px-3 py-1.5 font-semibold text-heading lg:inline-flex"
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
              {{ n }}
            </span>
          }
          <button [appIconButton]="'portal.logout' | transloco" type="button" (click)="logout()">
            <app-icon name="log-out" />
          </button>
        </div>
      </div>
      <nav
        class="border-t border-border md:hidden"
        [attr.aria-label]="'portal.nav.label' | transloco"
      >
        <div class="wrap overflow-x-auto"><ng-container *ngTemplateOutlet="links" /></div>
      </nav>
    </header>

    <ng-template #links>
      <ul class="m-0 flex list-none gap-1 p-0">
        <li>
          <a
            class="block min-h-11 border-b-2 border-transparent px-2 py-3 text-[15px] font-medium whitespace-nowrap text-text no-underline hover:text-secondary"
            [routerLink]="locale.link('/portal')"
            routerLinkActive="!border-secondary !font-semibold !text-heading"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: true }"
            >{{ 'portal.nav.status' | transloco }}</a
          >
        </li>
        <li>
          <a
            class="block min-h-11 border-b-2 border-transparent px-2 py-3 text-[15px] font-medium whitespace-nowrap text-text no-underline hover:text-secondary"
            [routerLink]="locale.link('/portal/documents')"
            routerLinkActive="!border-secondary !font-semibold !text-heading"
            ariaCurrentWhenActive="page"
            >{{ 'portal.nav.documents' | transloco }}</a
          >
        </li>
        <li>
          <a
            class="block min-h-11 border-b-2 border-transparent px-2 py-3 text-[15px] font-medium whitespace-nowrap text-text no-underline hover:text-secondary"
            [routerLink]="locale.link('/contact')"
            >{{ 'portal.nav.support' | transloco }}</a
          >
        </li>
      </ul>
    </ng-template>

    <main id="main" class="grow py-8 md:py-12" tabindex="-1">
      <router-outlet />
    </main>
    <app-toast-outlet />
  `,
})
export class PortalShell {
  protected readonly locale = inject(LocaleService);
  private readonly store = inject(ApplicantSessionStore);
  private readonly router = inject(Router);

  protected readonly name = computed(() => {
    const p = this.store.me()?.personal;
    return [p?.firstName, p?.lastName].filter(Boolean).join(' ') || null;
  });

  /** First letter of the name; placeholder names like "[…]" get an icon instead. */
  protected readonly initial = computed(() => {
    const first = this.name()?.trim()[0] ?? '';
    return /\p{L}/u.test(first) ? first : null;
  });

  protected async logout(): Promise<void> {
    await this.store.logout().catch(() => undefined);
    await this.router.navigateByUrl(this.locale.link('/portal/login'));
  }
}
