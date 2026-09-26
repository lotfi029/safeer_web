import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { SiteStore } from '../../core/site/site.store';
import { ErrorPanel } from '../../features/errors/error-panel';
import { ToastOutlet } from '../../shared/ui/toast/toast';
import { LogoIntro } from './logo-intro';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

/**
 * Public site shell (SSR): skip link, header, main landmark, footer, toasts, first-visit intro.
 * If `GET /site` failed (review F8) the page body is the 503/500 panel and the status is already set.
 */
@Component({
  selector: 'app-public-shell',
  imports: [
    RouterOutlet,
    TranslocoPipe,
    SiteHeader,
    SiteFooter,
    ErrorPanel,
    ToastOutlet,
    LogoIntro,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col' },
  template: `
    <a
      class="sr-only z-[60] rounded-btn bg-primary px-4 py-3 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      href="#main"
      >{{ 'common.skipToContent' | transloco }}</a
    >
    <app-site-header />
    <main id="main" tabindex="-1" class="grow outline-none">
      @if (site.failure(); as failure) {
        <app-error-panel
          [kind]="failure === 'unavailable' ? 'unavailable' : 'serverError'"
          [retryHref]="url()"
        />
      } @else {
        <router-outlet />
      }
    </main>
    <app-site-footer />
    <app-toast-outlet />
    <app-logo-intro />
  `,
})
export class PublicShell {
  protected readonly site = inject(SiteStore);
  private readonly router = inject(Router);
  private readonly navUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly url = computed(() => this.navUrl());
}
