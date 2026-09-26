import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { DEFAULT_LANG, isLang } from './lang';
import { LocaleService } from './locale.service';

/**
 * Loads the locale's strings and sets `<html lang dir>` before anything under `/:lang/**` activates.
 * A guard (not a resolver) because child guards run before parent resolvers: redirects built by
 * child guards (e.g. to `/en/admin/login`) must already see the right language.
 */
export const langGuard: CanActivateFn = async (route) => {
  const param = route.paramMap.get('lang');
  await inject(LocaleService).use(isLang(param) ? param : DEFAULT_LANG);
  return true;
};
