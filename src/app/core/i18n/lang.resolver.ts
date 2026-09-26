import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { DEFAULT_LANG, isLang, Lang } from './lang';
import { LocaleService } from './locale.service';

/** Loads the locale's strings before `/:lang/**` renders, so SSR never shows raw keys. */
export const langResolver: ResolveFn<Lang> = async (route) => {
  const param = route.paramMap.get('lang');
  const lang = isLang(param) ? param : DEFAULT_LANG;
  await inject(LocaleService).use(lang);
  return lang;
};
