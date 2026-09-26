import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { forkJoin } from 'rxjs';
import type { DocumentGroup, Page } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, type Loaded } from '../../../core/data/loaded';

/*
 * Kept apart from the page component: public.routes.ts imports resolvers statically, so anything in
 * this file lands in the initial bundle while the component stays in its lazy chunk.
 */

export interface DocumentsPageData {
  page: Page;
  groups: DocumentGroup[];
}

/** Critical data: page meta + documents grouped by category. */
export const documentsResolver: ResolveFn<Loaded<DocumentsPageData>> = () => {
  const api = inject(PublicApi);
  return loadCritical(forkJoin({ page: api.page('documents'), groups: api.documents() }));
};
