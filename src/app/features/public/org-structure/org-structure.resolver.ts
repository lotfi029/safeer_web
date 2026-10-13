import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import type { OrgNode } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, type Loaded } from '../../../core/data/loaded';

/** `GET /org-chart`: the published positions as a forest (apart from the lazy page component). */
export const orgStructureResolver: ResolveFn<Loaded<OrgNode[]>> = () =>
  loadCritical(inject(PublicApi).orgChart());
