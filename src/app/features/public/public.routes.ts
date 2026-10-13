import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { boardResolver } from './board/board.resolver';
import { homeResolver } from './home/home.resolver';
import { aboutResolver } from './about/about.resolver';
import { orgStructureResolver } from './org-structure/org-structure.resolver';
import { workAreasResolver } from './work-areas/work-areas.resolver';
import { testimonialsResolver } from './testimonials/testimonials.resolver';
import { partnersResolver } from './partners/partners.resolver';
import { contactResolver } from './contact/contact.resolver';
import { governanceSectionResolver, licencesResolver } from './governance/governance.resolvers';
import { DEFAULT_GOVERNANCE_SECTION, legacyDocumentsPath } from '../../core/site/governance';
import { articleResolver, newsListResolver } from './news/news.resolvers';

/**
 * W5: retired routes. The SSR server answers these with a 301 (src/server/legacy.ts); these
 * redirects cover client-side navigation (e.g. an old CMS button link).
 */
export const RETIRED_ROUTES: Routes = [
  {
    path: 'documents',
    pathMatch: 'full',
    // A UrlTree (not a relative string) so `?category=` is dropped from the new URL.
    redirectTo: ({ queryParams }) => {
      const router = inject(Router);
      const lang =
        router.currentNavigation()?.initialUrl.root.children['primary']?.segments[0]?.path;
      return router.parseUrl(
        `/${lang === 'en' ? 'en' : 'ar'}${legacyDocumentsPath(queryParams['category'] as string | undefined)}`,
      );
    },
  },
  { path: 'scholarships', pathMatch: 'full', redirectTo: 'contact' },
  { path: 'apply', pathMatch: 'full', redirectTo: 'contact' },
  {
    matcher: (segments) => (segments[0]?.path === 'portal' ? { consumed: segments } : null),
    redirectTo: 'contact',
  },
];

/**
 * Public pages (SSR). Each page's critical data comes from a route resolver (`loadCritical`, F8)
 * bound to the component's `data` input (withComponentInputBinding); secondary sections load with
 * `loadSecondary` and degrade to empty.
 */
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    resolve: { data: homeResolver },
    loadComponent: () => import('./home/home').then((m) => m.HomePage),
  },
  {
    path: 'board',
    resolve: { data: boardResolver },
    loadComponent: () => import('./board/board').then((m) => m.BoardPage),
  },
  {
    path: 'about/org-structure',
    resolve: { data: orgStructureResolver },
    loadComponent: () => import('./org-structure/org-structure').then((m) => m.OrgStructurePage),
  },
  {
    path: 'about',
    resolve: { data: aboutResolver },
    loadComponent: () => import('./about/about').then((m) => m.AboutPage),
  },
  {
    path: 'work-areas',
    resolve: { data: workAreasResolver },
    loadComponent: () => import('./work-areas/work-areas').then((m) => m.WorkAreasPage),
  },
  {
    path: 'testimonials',
    resolve: { data: testimonialsResolver },
    loadComponent: () => import('./testimonials/testimonials').then((m) => m.TestimonialsPage),
  },
  {
    path: 'partners',
    resolve: { data: partnersResolver },
    loadComponent: () => import('./partners/partners').then((m) => m.PartnersPage),
  },
  // Governance (W4): `/governance` lands on the first section; licences have their own page.
  {
    path: 'governance',
    pathMatch: 'full',
    redirectTo: `governance/${DEFAULT_GOVERNANCE_SECTION}`,
  },
  {
    path: 'governance/licences',
    resolve: { data: licencesResolver },
    loadComponent: () => import('./governance/licences').then((m) => m.LicencesPage),
  },
  {
    path: 'governance/:slug',
    resolve: { data: governanceSectionResolver },
    runGuardsAndResolvers: 'paramsChange',
    loadComponent: () =>
      import('./governance/governance-section').then((m) => m.GovernanceSectionPage),
  },
  ...RETIRED_ROUTES,
  {
    path: 'contact',
    resolve: { data: contactResolver },
    loadComponent: () => import('./contact/contact').then((m) => m.ContactPage),
  },
  {
    path: 'news',
    resolve: { data: newsListResolver },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () => import('./news/news-list').then((m) => m.NewsListPage),
  },
  {
    path: 'news/:slug',
    resolve: { data: articleResolver },
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () => import('./news/article').then((m) => m.ArticlePage),
  },
  {
    path: 'newsletter/confirm',
    data: { mode: 'confirm' },
    loadComponent: () => import('./news/newsletter-token').then((m) => m.NewsletterTokenPage),
  },
  {
    path: 'newsletter/unsubscribe',
    data: { mode: 'unsubscribe' },
    loadComponent: () => import('./news/newsletter-token').then((m) => m.NewsletterTokenPage),
  },
];
