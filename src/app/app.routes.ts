import { Routes } from '@angular/router';
import { langCanMatch } from './core/i18n/lang';
import { langGuard } from './core/i18n/lang.guard';
import { siteResolver } from './core/site/site.store';
import { KIT_ROUTES } from './features/kit/kit.routes';
import { PUBLIC_ROUTES } from './features/public/public.routes';

export const routes: Routes = [
  // server.ts answers `/` with a cookie-aware 302; this only covers client-side navigation.
  { path: '', pathMatch: 'full', redirectTo: 'ar' },
  {
    path: ':lang',
    canMatch: [langCanMatch],
    canActivate: [langGuard],
    runGuardsAndResolvers: 'paramsChange',
    loadComponent: () => import('./layout/lang-shell').then((m) => m.LangShell),
    children: [
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
        path: '',
        loadComponent: () =>
          import('./layout/public-shell/public-shell').then((m) => m.PublicShell),
        resolve: { site: siteResolver },
        runGuardsAndResolvers: 'paramsChange',
        children: [
          ...PUBLIC_ROUTES,
          {
            path: '**',
            loadComponent: () => import('./features/errors/not-found').then((m) => m.NotFound),
          },
        ],
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/errors/bare-not-found').then((m) => m.BareNotFound),
  },
];
