import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { forkJoin, from } from 'rxjs';
import type { Page, TestimonialTheme, WorkArea } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, loadSecondary, type Loaded } from '../../../core/data/loaded';

/*
 * Kept apart from the page component: public.routes.ts imports resolvers statically, so anything in
 * this file lands in the initial bundle while the component stays in its lazy chunk.
 */

export interface WorkAreasPageData {
  page: Page;
  areas: WorkArea[];
  /** Secondary (testimonials themes): empty when `GET /testimonials` fails. */
  themes: TestimonialTheme[];
}

/**
 * Critical: page meta + work areas (failures → 404/503/500). Secondary: testimonial themes, which
 * degrade to an empty (hidden) section.
 */
export const workAreasResolver: ResolveFn<Loaded<WorkAreasPageData>> = () => {
  const api = inject(PublicApi);
  const testimonials = loadSecondary(api.testimonials(), { featured: [], list: [], themes: [] });
  return loadCritical(
    forkJoin({ page: api.page('work'), areas: api.workAreas(), testimonials: from(testimonials) }),
  ).then((loaded): Loaded<WorkAreasPageData> => {
    if (!loaded.data) {
      return loaded;
    }
    const { page, areas, testimonials: t } = loaded.data;
    return {
      failure: null,
      data: {
        page,
        areas: [...areas]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((a) => ({ ...a, items: [...a.items].sort((x, y) => x.sortOrder - y.sortOrder) })),
        themes: [...t.themes].sort((a, b) => a.sortOrder - b.sortOrder),
      },
    };
  });
};
