import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';

/**
 * Public origin used for canonical/hreflang/OG URLs. Browser: the page origin. Server: provided from
 * PUBLIC_SITE_URL in app.config.server.ts (never derived from the Host header).
 */
export const SITE_ORIGIN = new InjectionToken<string>('SITE_ORIGIN', {
  providedIn: 'root',
  factory: () => inject(DOCUMENT).location?.origin ?? '',
});
