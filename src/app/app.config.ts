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
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { MOCK_INTERCEPTORS } from './core/api/mocks/mock-interceptors';
import { apiBaseUrlInterceptor } from './core/http/api-base-url.interceptor';
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
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(
      withFetch(),
      // Order matters: locale → credentials → CSRF → problem normalisation → (dev mocks) →
      // base URL rewrite → SSR-only forwarding.
      withInterceptors([
        localeInterceptor,
        credentialsInterceptor,
        csrfInterceptor,
        problemDetailsInterceptor,
        ...MOCK_INTERCEPTORS,
        apiBaseUrlInterceptor,
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
