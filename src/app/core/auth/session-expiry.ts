import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { LocaleService } from '../i18n/locale.service';
import { CsrfTokens } from './csrf-tokens';

/** Clears the staff session and sends the user to the admin login with a return URL. */
@Injectable({ providedIn: 'root' })
export class SessionExpiry {
  private readonly router = inject(Router);
  private readonly locale = inject(LocaleService);
  private readonly tokens = inject(CsrfTokens);
  private readonly listeners: ((area: 'admin') => void)[] = [];

  onExpired(listener: (area: 'admin') => void): void {
    this.listeners.push(listener);
  }

  expired(area: 'admin'): void {
    this.tokens.staff.set(null);
    this.listeners.forEach((l) => l(area));
    const returnUrl = this.router.url;
    if (returnUrl.includes(`/${area}/login`)) {
      return;
    }
    void this.router.navigate([this.locale.link(`/${area}/login`)], { queryParams: { returnUrl } });
  }
}
