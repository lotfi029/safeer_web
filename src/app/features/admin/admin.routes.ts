import { Routes } from '@angular/router';

/** Admin dashboard (client-rendered). Phase 0 placeholder; Session 2 builds the real screens. */
export const ADMIN_ROUTES: Routes = [
  {
    path: '**',
    loadComponent: () => import('./admin-placeholder').then((m) => m.AdminPlaceholder),
  },
];
