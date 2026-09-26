import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, REQUEST } from '@angular/core';

/** Reads cookies on both platforms (SSR: request header) and writes them in the browser only. */
@Injectable({ providedIn: 'root' })
export class Cookies {
  private readonly document = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true });
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  get(name: string): string | undefined {
    const header = this.isBrowser
      ? this.document.cookie
      : (this.request?.headers.get('cookie') ?? '');
    for (const part of header.split(';')) {
      const eq = part.indexOf('=');
      if (eq > 0 && part.slice(0, eq).trim() === name) {
        try {
          return decodeURIComponent(part.slice(eq + 1).trim());
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  /** Non-sensitive preference cookies only (lang, theme, intro). One year, SameSite=Lax. */
  set(name: string, value: string, maxAgeSeconds = 31_536_000): void {
    if (!this.isBrowser) {
      return;
    }
    const secure = this.document.location?.protocol === 'https:' ? '; Secure' : '';
    this.document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
  }
}
