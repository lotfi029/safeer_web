import type { Routes } from '@angular/router';

/**
 * Dev-only component kit (`/:lang/_kit`): every UI component in every state, RTL/LTR, light/dark.
 * Replaced by kit.routes.prod.ts in production builds; present in `ng serve` and the e2e build.
 */
export const SAFEER_KIT_ROUTE = 'SAFEER_KIT_ROUTE';

export const KIT_ROUTES: Routes = [
  {
    path: '_kit',
    data: { marker: SAFEER_KIT_ROUTE },
    loadComponent: () => import('./kit-page').then((m) => m.KitPage),
  },
];
