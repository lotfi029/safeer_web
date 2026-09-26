import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ResolveFn } from '@angular/router';
import type { Page } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, type Loaded } from '../../../core/data/loaded';

/** STUB — to be implemented (Phase 3). */
export const contactResolver: ResolveFn<Loaded<Page>> = () =>
  loadCritical(inject(PublicApi).page('contact'));

@Component({
  selector: 'app-contact-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="wrap section">
    <h1 class="t-h1">{{ data().data?.title }}</h1>
  </section>`,
})
export class ContactPage {
  readonly data = input.required<Loaded<Page>>();
}
