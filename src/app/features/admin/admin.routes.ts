import { Routes } from '@angular/router';
import { roleGuard, staffGuard, staffLoginGuard } from '../../core/auth/guards';
import { adminStringsGuard } from '../../core/i18n/admin-strings';

/**
 * Admin (client-rendered, `no-store` + `noindex`). Signed-out pages sit beside the shell; every
 * dashboard page is a shell child with `canActivate: [roleGuard]` and `data: { area }` from the
 * `GET /admin/roles` matrix (no area = any staff member). `adminStringsGuard` loads the admin
 * dictionary for the current locale first.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminStringsGuard],
    runGuardsAndResolvers: 'paramsChange',
    children: [
      {
        path: 'login',
        canActivate: [staffLoginGuard],
        loadComponent: () => import('./auth/admin-login').then((m) => m.AdminLogin),
      },
      {
        path: 'forgot',
        canActivate: [staffLoginGuard],
        loadComponent: () => import('./auth/forgot').then((m) => m.AdminForgot),
      },
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
        canActivate: [staffGuard],
        loadComponent: () => import('./layout/admin-shell').then((m) => m.AdminShell),
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./overview/overview').then((m) => m.AdminOverviewPage),
          },
          {
            path: 'forbidden',
            loadComponent: () => import('./forbidden').then((m) => m.Forbidden),
          },
          {
            path: 'applications',
            canActivate: [roleGuard],
            data: { area: 'applications' },
            loadComponent: () =>
              import('./applications/applications-list').then((m) => m.ApplicationsList),
          },
          {
            path: 'applications/:id',
            canActivate: [roleGuard],
            data: { area: 'applications' },
            loadComponent: () =>
              import('./applications/application-review').then((m) => m.ApplicationReview),
          },
          {
            path: 'messages',
            canActivate: [roleGuard],
            data: { area: 'inbox' },
            loadComponent: () => import('./messages/messages').then((m) => m.MessagesPage),
          },
          {
            path: 'messages/:id',
            canActivate: [roleGuard],
            data: { area: 'inbox' },
            loadComponent: () => import('./messages/messages').then((m) => m.MessagesPage),
          },
          { path: '**', redirectTo: '' },
        ],
      },
    ],
  },
];
