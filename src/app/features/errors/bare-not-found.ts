import { ChangeDetectionStrategy, Component, inject, RESPONSE_INIT } from '@angular/core';

/** 404 for paths outside `/ar|/en` (no locale → no shell). Links to both languages. */
@Component({
  selector: 'app-bare-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="main" class="wrap flex min-h-dvh flex-col items-start justify-center gap-4 py-16">
      <p class="t-eyebrow">404</p>
      <h1 class="t-h2" lang="ar" dir="rtl">الصفحة غير موجودة</h1>
      <p class="t-h4" lang="en" dir="ltr">Page not found</p>
      <p class="flex gap-4">
        <a href="/ar" lang="ar" hreflang="ar">العودة إلى الرئيسية</a>
        <a href="/en" lang="en" hreflang="en">Back to home</a>
      </p>
    </main>
  `,
})
export class BareNotFound {
  constructor() {
    const responseInit = inject(RESPONSE_INIT, { optional: true });
    if (responseInit) {
      responseInit.status = 404;
    }
  }
}
