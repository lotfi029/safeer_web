import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-admin-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      id="main"
      class="mx-auto flex min-h-dvh max-w-[1280px] flex-col items-center justify-center gap-4 px-5"
    >
      <h1 class="text-3xl font-bold text-primary">لوحة التحكم</h1>
      <p class="text-text-muted">[...]</p>
    </main>
  `,
})
export class AdminPlaceholder {
  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }
}
