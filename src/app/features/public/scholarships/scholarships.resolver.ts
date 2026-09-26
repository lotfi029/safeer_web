import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { forkJoin } from 'rxjs';
import type { AboutItem, Page } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, type Loaded } from '../../../core/data/loaded';

/*
 * Kept apart from the page component: public.routes.ts imports resolvers statically, so anything in
 * this file lands in the initial bundle while the component stays in its lazy chunk.
 */

export interface ScholarshipsPageData {
  page: Page;
  pillars: AboutItem[];
  steps: AboutItem[];
  requirements: AboutItem[];
}

const bySort = (a: AboutItem, b: AboutItem) => a.sortOrder - b.sortOrder;

/** Critical data: page meta + care pillars, steps and requirements (B18, mocked). */
export const scholarshipsResolver: ResolveFn<Loaded<ScholarshipsPageData>> = () => {
  const api = inject(PublicApi);
  return loadCritical(
    forkJoin({
      page: api.page('scholarships'),
      items: api.aboutItems(['care_pillar', 'scholarship_step', 'requirement']),
    }),
  ).then((loaded): Loaded<ScholarshipsPageData> => {
    if (!loaded.data) {
      return loaded;
    }
    const { page, items } = loaded.data;
    return {
      failure: null,
      data: {
        page,
        pillars: [...(items.care_pillar ?? [])].sort(bySort),
        steps: [...(items.scholarship_step ?? [])].sort(bySort),
        requirements: [...(items.requirement ?? [])].sort(bySort),
      },
    };
  });
};
