import { Routes } from '@angular/router';

/** Public pages (SSR). Phase 3/4/5 replace the placeholder home and add every page here. */
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./placeholder-home').then((m) => m.PlaceholderHome),
  },
];
