import { IMAGE_LOADER } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
  withIncrementalHydration,
} from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { MOCK_INTERCEPTORS } from './core/api/mocks/mock-interceptors';
import {
  credentialsInterceptor,
  csrfInterceptor,
  localeInterceptor,
  problemDetailsInterceptor,
} from './core/http/interceptors';
import { serverForwardInterceptor } from './core/http/server-forward.interceptor';
import { isTransferCacheable } from './core/http/transfer-cache';
import { provideAppTransloco } from './core/i18n/transloco';
import { ThemeService } from './core/theme/theme.service';
import { filesImageLoader } from './shared/ui/image/files-image-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Child routes see `:lang` (and re-run resolvers when it changes).
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // Route transition (spec §2): opacity + 8px ~300ms, styles in motion.css; off under reduced motion.
      withViewTransitions({ skipInitialTransition: true }),
    ),
    provideHttpClient(
      withFetch(),
      // Order matters: locale → credentials → CSRF → problem normalisation → (dev mocks) →
      // SSR-only forwarding. On the server, InternalApiBackend (app.config.server.ts) sends
      // `/api/v1` to the internal API below all of these and the transfer cache (W9).
      withInterceptors([
        localeInterceptor,
        credentialsInterceptor,
        csrfInterceptor,
        problemDetailsInterceptor,
        ...MOCK_INTERCEPTORS,
        serverForwardInterceptor,
      ]),
    ),
    provideClientHydration(
      withIncrementalHydration(),
      withEventReplay(),
      withHttpTransferCacheOptions({
        includeRequestsWithAuthHeaders: false,
        filter: isTransferCacheable,
      }),
    ),
    provideAppTransloco(),
    { provide: IMAGE_LOADER, useValue: filesImageLoader },
    provideAppInitializer(() => inject(ThemeService).init()),
  ],
};
