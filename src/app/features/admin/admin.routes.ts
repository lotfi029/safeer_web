import { Routes } from '@angular/router';
import { permissionGuard, staffGuard, staffLoginGuard } from '../../core/auth/guards';
import type { PermissionKey } from '../../core/auth/permissions';
import { adminStringsGuard } from '../../core/i18n/admin-strings';

/**
 * Admin (client-rendered, `no-store` + `noindex`). Signed-out pages sit beside the shell; every
 * dashboard page is a shell child with `canActivate: [permissionGuard]` and
 * `data: { permission }` — the `<module>.view` key from `GET /admin/me` → `permissions` (v1.1.0;
 * none = any staff member). `adminStringsGuard` loads the admin dictionary for the current locale
 * first.
 */
/** A config-driven content screen (CrudPage) for the given CRUD collections. */
function crud(
  path: string,
  collections: string[],
  title: string,
  permission: PermissionKey,
  note: string | null = null,
): Routes {
  return [
    {
      path,
      canActivate: [permissionGuard],
      data: { permission, collections, title, note },
      loadComponent: () => import('./content/crud/crud-page').then((m) => m.CrudPage),
    },
  ];
}

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
            path: 'messages',
            canActivate: [permissionGuard],
            data: { permission: 'messages.view' },
            loadComponent: () => import('./messages/messages').then((m) => m.MessagesPage),
          },
          {
            path: 'messages/:id',
            canActivate: [permissionGuard],
            data: { permission: 'messages.view' },
            loadComponent: () => import('./messages/messages').then((m) => m.MessagesPage),
          },
          // ---------- content (Phase 8) ----------
          ...crud('pages', ['pages'], 'pages', 'pages.view'),
          {
            path: 'pages/:id',
            canActivate: [permissionGuard],
            data: { permission: 'pages.view' },
            loadComponent: () => import('./content/pages/page-editor').then((m) => m.PageEditor),
          },
          {
            path: 'news',
            canActivate: [permissionGuard],
            data: { permission: 'news.view' },
            loadComponent: () => import('./content/news/news-list').then((m) => m.AdminNewsList),
          },
          ...crud('news/categories', ['newsCategories'], 'newsCategories', 'news.view'),
          {
            path: 'news/new',
            canActivate: [permissionGuard],
            data: { permission: 'news.manage' },
            loadComponent: () => import('./content/news/news-editor').then((m) => m.NewsEditor),
          },
          {
            path: 'news/:id',
            canActivate: [permissionGuard],
            data: { permission: 'news.view' },
            loadComponent: () => import('./content/news/news-editor').then((m) => m.NewsEditor),
          },
          ...crud('work-areas', ['workAreas'], 'workAreas', 'workAreas.view', 'workAreas.note'),
          ...crud('board', ['board'], 'board', 'board.view'),
          {
            path: 'org-chart',
            canActivate: [permissionGuard],
            data: { permission: 'orgChart.view' },
            loadComponent: () =>
              import('./content/org-chart/org-chart-admin').then((m) => m.OrgChartAdmin),
          },
          ...crud(
            'testimonials',
            ['themes', 'testimonials'],
            'testimonials',
            'testimonials.view',
            'testimonials.note',
          ),
          ...crud('partners', ['partners'], 'partners', 'partners.view'),
          ...crud(
            'documents',
            ['documents', 'docCategories'],
            'documents',
            'documents.view',
            'documents.note',
          ),
          ...crud('licences', ['licences'], 'licences', 'licences.view', 'licences.note'),
          ...crud('stats', ['stats'], 'stats', 'stats.view', 'stats.note'),
          ...crud('about-items', ['aboutItems'], 'aboutItems', 'aboutItems.view'),
          {
            path: 'media',
            canActivate: [permissionGuard],
            data: { permission: 'media.view' },
            loadComponent: () =>
              import('./content/media/media-library').then((m) => m.MediaLibrary),
          },
          // ---------- system (Phase 9) ----------
          ...crud('redirects', ['redirects'], 'redirects', 'redirects.view', 'redirects.note'),
          {
            path: 'newsletter',
            canActivate: [permissionGuard],
            data: { permission: 'newsletter.view' },
            loadComponent: () => import('./system/newsletter').then((m) => m.AdminNewsletter),
          },
          {
            path: 'system/users',
            canActivate: [permissionGuard],
            data: { permission: 'users.view' },
            loadComponent: () => import('./system/users').then((m) => m.AdminUsers),
          },
          {
            path: 'system/roles',
            canActivate: [permissionGuard],
            data: { permission: 'roles.view' },
            loadComponent: () => import('./system/roles').then((m) => m.AdminRoles),
          },
          {
            path: 'system/settings',
            canActivate: [permissionGuard],
            data: { permission: 'settings.view' },
            loadComponent: () => import('./system/settings').then((m) => m.AdminSettings),
          },
          {
            path: 'system/mail',
            canActivate: [permissionGuard],
            data: { permission: 'mail.view', channel: 'mail' },
            loadComponent: () => import('./system/channel').then((m) => m.AdminChannel),
          },
          {
            path: 'system/audit',
            canActivate: [permissionGuard],
            data: { permission: 'audit.view' },
            loadComponent: () => import('./system/audit').then((m) => m.AdminAudit),
          },
          {
            path: 'account',
            loadComponent: () => import('./system/account').then((m) => m.AdminAccount),
          },
          { path: '**', redirectTo: '' },
        ],
      },
    ],
  },
];
