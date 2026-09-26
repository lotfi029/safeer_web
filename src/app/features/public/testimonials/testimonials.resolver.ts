import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { forkJoin } from 'rxjs';
import type { Page, TestimonialsResponse } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, type Loaded } from '../../../core/data/loaded';

/*
 * Kept apart from the page component: public.routes.ts imports resolvers statically, so anything in
 * this file lands in the initial bundle while the component stays in its lazy chunk.
 */

export interface TestimonialsPageData {
  page: Page;
  testimonials: TestimonialsResponse;
}

/** Critical data: page meta + testimonials (featured, list, themes). */
export const testimonialsResolver: ResolveFn<Loaded<TestimonialsPageData>> = () => {
  const api = inject(PublicApi);
  return loadCritical(
    forkJoin({ page: api.page('testimonials'), testimonials: api.testimonials() }),
  );
};
