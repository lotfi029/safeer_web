import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import type { Page } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, type Loaded } from '../../../core/data/loaded';

export const contactResolver: ResolveFn<Loaded<Page>> = () =>
  loadCritical(inject(PublicApi).page('contact'));
