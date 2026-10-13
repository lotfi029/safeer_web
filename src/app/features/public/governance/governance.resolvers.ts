import { inject, RESPONSE_INIT } from '@angular/core';
import { ResolveFn } from '@angular/router';
import type { DocSectionResponse, Licence } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, markStatus, type Loaded } from '../../../core/data/loaded';

// Resolvers live apart from the page components: public.routes.ts imports them statically, so this
// file lands in the initial bundle while the components stay in their lazy chunks.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * `GET /documents/sections/:slug`: an unknown or unpublished section is a 404 (the page renders the
 * not-found panel, SSR status 404). A malformed slug never reaches the API.
 */
export const governanceSectionResolver: ResolveFn<Loaded<DocSectionResponse>> = (route) => {
  const slug = route.paramMap.get('slug') ?? '';
  if (!SLUG.test(slug)) {
    markStatus(inject(RESPONSE_INIT, { optional: true }), 'notFound');
    return { data: null, failure: 'notFound' };
  }
  return loadCritical(inject(PublicApi).docSection(slug));
};

/** `GET /licences` (primary first). */
export const licencesResolver: ResolveFn<Loaded<Licence[]>> = () =>
  loadCritical(inject(PublicApi).licences());
