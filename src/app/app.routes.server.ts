import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Public pages are server-rendered per request (CMS content, so no prerendering).
 * The admin dashboard and student portal are client-rendered.
 */
export const serverRoutes: ServerRoute[] = [
  { path: ':lang/admin', renderMode: RenderMode.Client },
  { path: ':lang/admin/**', renderMode: RenderMode.Client },
  { path: ':lang/portal', renderMode: RenderMode.Client },
  { path: ':lang/portal/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
