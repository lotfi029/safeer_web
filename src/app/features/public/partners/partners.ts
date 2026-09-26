import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ResolveFn } from '@angular/router';
import type { Page } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, type Loaded } from '../../../core/data/loaded';

/** STUB — to be implemented (Phase 3). */
export const partnersResolver: ResolveFn<Loaded<Page>> = () =>
  loadCritical(inject(PublicApi).page('partners'));

@Component({
  selector: 'app-partners-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="wrap section">
    <h1 class="t-h1">{{ data().data?.title }}</h1>
  </section>`,
})
export class PartnersPage {
  readonly data = input.required<Loaded<Page>>();
}
