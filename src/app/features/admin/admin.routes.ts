import { Routes } from '@angular/router';
import { roleGuard, staffGuard, staffLoginGuard } from '../../core/auth/guards';

/**
 * Admin (client-rendered). Session 1 ships the auth plumbing only: a stub login, the no-access page
 * and one guarded placeholder per guard type. Session 2 adds the dashboard routes here, each with
 * `canActivate: [staffGuard, roleGuard]` and `data: { area }` from the GET /admin/roles matrix.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    canActivate: [staffLoginGuard],
    loadComponent: () => import('./auth/admin-login').then((m) => m.AdminLogin),
  },
  { path: 'forbidden', loadComponent: () => import('./forbidden').then((m) => m.Forbidden) },
  // W16: the links the API mails to staff (C2). Public: the token is the credential.
  {
    path: 'accept/:token',
    data: { mode: 'accept' },
    loadComponent: () => import('./auth/set-password').then((m) => m.AdminSetPassword),
  },
  {
    path: 'reset/:token',
    data: { mode: 'reset' },
    loadComponent: () => import('./auth/set-password').then((m) => m.AdminSetPassword),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin-placeholder').then((m) => m.AdminPlaceholder),
  },
  {
    // Guarded example: only roles with the `users` area (admin) may enter.
    path: 'system/users',
    canActivate: [staffGuard, roleGuard],
    data: { area: 'users' },
    loadComponent: () => import('./admin-placeholder').then((m) => m.AdminPlaceholder),
  },
  { path: '**', redirectTo: '' },
];
