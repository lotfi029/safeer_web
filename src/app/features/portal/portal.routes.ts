import { Routes } from '@angular/router';

/** Student portal (client-rendered). Phase 0 placeholder; built in Phase 6. */
export const PORTAL_ROUTES: Routes = [
  {
    path: '**',
    loadComponent: () => import('./portal-placeholder').then((m) => m.PortalPlaceholder),
  },
];
