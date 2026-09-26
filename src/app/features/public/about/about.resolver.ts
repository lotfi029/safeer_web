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

export interface AboutPageData {
  page: Page;
  vision: AboutItem[];
  mission: AboutItem[];
  goals: AboutItem[];
}

const bySort = (a: AboutItem, b: AboutItem) => a.sortOrder - b.sortOrder;

/** Critical data: page meta + vision/mission/goals (B18, mocked). Failures → 404/503/500. */
export const aboutResolver: ResolveFn<Loaded<AboutPageData>> = () => {
  const api = inject(PublicApi);
  return loadCritical(
    forkJoin({
      page: api.page('about'),
      items: api.aboutItems(['vision', 'mission', 'goal']),
    }),
  ).then((loaded): Loaded<AboutPageData> => {
    if (!loaded.data) {
      return loaded;
    }
    const { page, items } = loaded.data;
    return {
      failure: null,
      data: {
        page,
        vision: [...(items.vision ?? [])].sort(bySort),
        mission: [...(items.mission ?? [])].sort(bySort),
        goals: [...(items.goal ?? [])].sort(bySort),
      },
    };
  });
};
