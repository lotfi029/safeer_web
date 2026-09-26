import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Cookies } from '../platform/cookies';

export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_COOKIE = 'theme';

/**
 * Light/dark theme. The preference lives in a cookie so SSR renders `<html data-theme>` directly
 * (no flash). Without a cookie the OS preference applies through CSS (`prefers-color-scheme`).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly cookies = inject(Cookies);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly preference = signal<ThemePreference>('system');

  /** Called once at start-up (server and client) to mirror the cookie onto `<html>`. */
  init(): void {
    const value = this.cookies.get(THEME_COOKIE);
    const pref: ThemePreference = value === 'light' || value === 'dark' ? value : 'system';
    this.apply(pref);
  }

  /** The theme actually shown (resolves `system` via matchMedia in the browser). */
  effective(): 'light' | 'dark' {
    const pref = this.preference();
    if (pref !== 'system') {
      return pref;
    }
    if (this.isBrowser && typeof matchMedia === 'function') {
      return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  toggle(): void {
    const next = this.effective() === 'dark' ? 'light' : 'dark';
    this.cookies.set(THEME_COOKIE, next);
    this.apply(next);
  }

  private apply(pref: ThemePreference): void {
    this.preference.set(pref);
    const root = this.document.documentElement;
    if (pref === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', pref);
    }
  }
}
