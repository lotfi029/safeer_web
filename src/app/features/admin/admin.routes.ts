import { Routes } from '@angular/router';
import { roleGuard, staffGuard, staffLoginGuard } from '../../core/auth/guards';
import type { StaffArea } from '../../core/auth/role-matrix';
import { adminStringsGuard } from '../../core/i18n/admin-strings';

/**
 * Admin (client-rendered, `no-store` + `noindex`). Signed-out pages sit beside the shell; every
 * dashboard page is a shell child with `canActivate: [roleGuard]` and `data: { area }` from the
 * `GET /admin/roles` matrix (no area = any staff member). `adminStringsGuard` loads the admin
 * dictionary for the current locale first.
 */
/** A config-driven content screen (CrudPage) for the given CRUD collections. */
function crud(
  path: string,
  collections: string[],
  title: string,
  note: string | null = null,
  area: StaffArea = 'content',
): Routes {
  return [
    {
      path,
      canActivate: [roleGuard],
      data: { area, collections, title, note },
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
          // ---------- content (Phase 8) ----------
          ...crud('pages', ['pages'], 'pages'),
          {
            path: 'pages/:id',
            canActivate: [roleGuard],
            data: { area: 'content' },
            loadComponent: () => import('./content/pages/page-editor').then((m) => m.PageEditor),
          },
          {
            path: 'news',
            canActivate: [roleGuard],
            data: { area: 'content' },
            loadComponent: () => import('./content/news/news-list').then((m) => m.AdminNewsList),
          },
          ...crud('news/categories', ['newsCategories'], 'newsCategories'),
          {
            path: 'news/new',
            canActivate: [roleGuard],
            data: { area: 'content' },
            loadComponent: () => import('./content/news/news-editor').then((m) => m.NewsEditor),
          },
          {
            path: 'news/:id',
            canActivate: [roleGuard],
            data: { area: 'content' },
            loadComponent: () => import('./content/news/news-editor').then((m) => m.NewsEditor),
          },
          ...crud('work-areas', ['workAreas'], 'workAreas', 'workAreas.note'),
          ...crud('board', ['board'], 'board'),
          ...crud(
            'testimonials',
            ['themes', 'testimonials'],
            'testimonials',
            'testimonials.note',
            'inbox',
          ),
          ...crud('partners', ['partners'], 'partners'),
          ...crud('documents', ['documents', 'docCategories'], 'documents', 'documents.note'),
          ...crud('stats', ['stats'], 'stats', 'stats.note'),
          ...crud('about-items', ['aboutItems'], 'aboutItems'),
          {
            path: 'media',
            canActivate: [roleGuard],
            data: { area: 'content' },
            loadComponent: () =>
              import('./content/media/media-library').then((m) => m.MediaLibrary),
          },
          // ---------- system (Phase 9) ----------
          ...crud('redirects', ['redirects'], 'redirects', 'redirects.note'),
          ...crud(
            'interview-slots',
            ['interviewSlots'],
            'interviewSlots',
            'interviewSlots.note',
            'applications',
          ),
          {
            path: 'newsletter',
            canActivate: [roleGuard],
            data: { area: 'inbox' },
            loadComponent: () => import('./system/newsletter').then((m) => m.AdminNewsletter),
          },
          {
            path: 'system/users',
            canActivate: [roleGuard],
            data: { area: 'users' },
            loadComponent: () => import('./system/users').then((m) => m.AdminUsers),
          },
          {
            path: 'system/settings',
            canActivate: [roleGuard],
            data: { area: 'settings' },
            loadComponent: () => import('./system/settings').then((m) => m.AdminSettings),
          },
          {
            path: 'system/mail',
            canActivate: [roleGuard],
            data: { area: 'settings', channel: 'mail' },
            loadComponent: () => import('./system/channel').then((m) => m.AdminChannel),
          },
          {
            path: 'system/sms',
            canActivate: [roleGuard],
            data: { area: 'settings', channel: 'sms' },
            loadComponent: () => import('./system/channel').then((m) => m.AdminChannel),
          },
          {
            path: 'system/audit',
            canActivate: [roleGuard],
            data: { area: 'audit' },
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
