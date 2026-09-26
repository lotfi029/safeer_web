import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import type { Country } from '../../core/api/models';
import { PublicApi } from '../../core/api/public-api';
import { loadSecondary } from '../../core/data/loaded';

/** Countries are secondary (F8): without them nationality falls back to a 2-letter code input. */
export const applyResolver: ResolveFn<Country[]> = () =>
  loadSecondary(inject(PublicApi).countries(), [] as Country[]);
