import { ChangeDetectionStrategy, Component, inject, RESPONSE_INIT } from '@angular/core';

/** 404 placeholder (full design in Phase 2). SSR answers with HTTP 404. */
@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      id="main"
      class="mx-auto flex min-h-dvh max-w-[1280px] flex-col items-center justify-center gap-4 px-5 text-center"
    >
      <h1 class="text-4xl font-bold text-primary">404</h1>
      <p class="text-text-muted">[...]</p>
      <a href="/" class="inline-flex min-h-11 items-center text-secondary underline">/</a>
    </main>
  `,
})
export class NotFound {
  constructor() {
    const responseInit = inject(RESPONSE_INIT, { optional: true });
    if (responseInit) {
      responseInit.status = 404;
    }
  }
}
