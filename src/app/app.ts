import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<router-outlet />',
})
export class App {
  constructor() {
    const document = inject(DOCUMENT);
    // `<html data-hydrated>` once the first client render has run: inputs typed before this are
    // lost (event replay covers clicks, not input), so e2e waits for it before filling forms.
    afterNextRender(() => document.documentElement.setAttribute('data-hydrated', ''));
  }
}
