import { HttpBackend } from '@angular/common/http';
import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_BASE_URL, API_PREFIX } from './core/config/api-base-url';
import { SITE_ORIGIN } from './core/config/site-origin';
import { InternalApiBackend } from './core/http/internal-api.backend';

/** SSR calls the API directly on the internal network, not through the public proxy. */
function internalApiBase(): string {
  const origin = (process.env['API_INTERNAL_URL'] ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
  return `${origin}${API_PREFIX}`;
}

/** Canonical URLs always use PUBLIC_SITE_URL, never the request's Host header. */
function publicOrigin(): string {
  try {
    return new URL(process.env['PUBLIC_SITE_URL'] ?? 'http://localhost:4000').origin;
  } catch {
    return 'http://localhost:4000';
  }
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: API_BASE_URL, useFactory: internalApiBase },
    // W9: the internal rewrite sits below the transfer cache (see InternalApiBackend).
    InternalApiBackend,
    { provide: HttpBackend, useExisting: InternalApiBackend },
    { provide: SITE_ORIGIN, useFactory: publicOrigin },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
