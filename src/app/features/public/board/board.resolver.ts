import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { forkJoin } from 'rxjs';
import type { BoardMember, Page } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, type Loaded } from '../../../core/data/loaded';

export interface BoardPageData {
  page: Page;
  members: BoardMember[];
}

/** Critical data: page meta + members (both needed to render; failures → 404/503/500). */
export const boardResolver: ResolveFn<Loaded<BoardPageData>> = () => {
  const api = inject(PublicApi);
  return loadCritical(forkJoin({ page: api.page('board'), members: api.board() }));
};
