import { ChangeDetectionStrategy, Component, inject, RESPONSE_INIT } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { ErrorPanel } from './error-panel';

/** 404 inside the public shell. SSR answers with HTTP 404 and `noindex`. */
@Component({
  selector: 'app-not-found',
  imports: [ErrorPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-error-panel kind="notFound" />`,
})
export class NotFound {
  constructor() {
    const responseInit = inject(RESPONSE_INIT, { optional: true });
    if (responseInit) {
      responseInit.status = 404;
    }
    const locale = inject(LocaleService);
    const title = inject(TranslocoService).translate('errorPages.notFound.title');
    inject(SeoService).set({ title, path: '/404', lang: locale.lang(), noindex: true });
  }
}
