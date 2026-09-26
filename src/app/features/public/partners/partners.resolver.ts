import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { forkJoin } from 'rxjs';
import type { Page, Partner } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, type Loaded } from '../../../core/data/loaded';

/*
 * Kept apart from the page component: public.routes.ts imports resolvers statically, so anything in
 * this file lands in the initial bundle while the component stays in its lazy chunk.
 */

export interface PartnersPageData {
  page: Page;
  partners: Partner[];
}

/**
 * Critical data: page meta + all partners. The `?category=` filter is applied client-side from the
 * URL (the route does not re-run resolvers on query changes), so the chips stay plain links.
 */
export const partnersResolver: ResolveFn<Loaded<PartnersPageData>> = () => {
  const api = inject(PublicApi);
  return loadCritical(forkJoin({ page: api.page('partners'), partners: api.partners() }));
};
