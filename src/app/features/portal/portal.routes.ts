import { Routes } from '@angular/router';
import { applicantGuard, applicantLoginGuard } from '../../core/auth/guards';

/**
 * Student portal (client-rendered, noindex). `/:lang/portal/login` (C2) is public; everything else
 * sits in the portal shell behind `applicantGuard` (anonymous → login with `returnUrl`).
 */
export const PORTAL_ROUTES: Routes = [
  {
    path: 'login',
    canActivate: [applicantLoginGuard],
    loadComponent: () => import('./portal-login').then((m) => m.PortalLogin),
  },
  {
    path: '',
    canActivate: [applicantGuard],
    loadComponent: () => import('./portal-shell').then((m) => m.PortalShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./portal-status').then((m) => m.PortalStatus),
      },
      {
        path: 'documents',
        loadComponent: () => import('./portal-documents').then((m) => m.PortalDocuments),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
