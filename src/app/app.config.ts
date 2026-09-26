import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { apiBaseUrlInterceptor } from './core/http/api-base-url.interceptor';
import { serverForwardInterceptor } from './core/http/server-forward.interceptor';
import { isTransferCacheable } from './core/http/transfer-cache';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiBaseUrlInterceptor, serverForwardInterceptor]),
    ),
    provideClientHydration(
      withIncrementalHydration(),
      withEventReplay(),
      withHttpTransferCacheOptions({
        includeRequestsWithAuthHeaders: false,
        filter: isTransferCacheable,
      }),
    ),
  ],
};
