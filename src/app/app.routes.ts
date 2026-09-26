import { Routes } from '@angular/router';
import { langCanMatch } from './core/i18n/lang';
import { langResolver } from './core/i18n/lang.resolver';
import { KIT_ROUTES } from './features/kit/kit.routes';

export const routes: Routes = [
  // server.ts answers `/` with a cookie-aware 302; this only covers client-side navigation.
  { path: '', pathMatch: 'full', redirectTo: 'ar' },
  {
    path: ':lang',
    canMatch: [langCanMatch],
    resolve: { resolvedLang: langResolver },
    runGuardsAndResolvers: 'paramsChange',
    loadComponent: () => import('./layout/lang-shell').then((m) => m.LangShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/public/placeholder-home').then((m) => m.PlaceholderHome),
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        path: 'portal',
        loadChildren: () => import('./features/portal/portal.routes').then((m) => m.PORTAL_ROUTES),
      },
      ...KIT_ROUTES,
      {
        path: '**',
        loadComponent: () => import('./features/errors/not-found').then((m) => m.NotFound),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/errors/not-found').then((m) => m.NotFound),
  },
];
