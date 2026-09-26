import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import type { HomeResponse } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, type Loaded } from '../../../core/data/loaded';

// Resolvers live apart from page components: public.routes.ts imports them statically, so this
// file lands in the initial bundle while the component stays in its lazy chunk.
export const homeResolver: ResolveFn<Loaded<HomeResponse>> = () =>
  loadCritical(inject(PublicApi).home());
