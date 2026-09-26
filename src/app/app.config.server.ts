import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_BASE_URL, API_PREFIX } from './core/config/api-base-url';

/** SSR calls the API directly on the internal network, not through the public proxy. */
function internalApiBase(): string {
  const origin = (process.env['API_INTERNAL_URL'] ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
  return `${origin}${API_PREFIX}`;
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: API_BASE_URL, useFactory: internalApiBase },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
