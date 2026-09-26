import { Routes } from '@angular/router';
import { boardResolver } from './board/board';
import { homeResolver } from './home/home';
import { aboutResolver } from './about/about';
import { workAreasResolver } from './work-areas/work-areas';
import { scholarshipsResolver } from './scholarships/scholarships';
import { testimonialsResolver } from './testimonials/testimonials';
import { partnersResolver } from './partners/partners';
import { documentsResolver } from './documents/documents';
import { contactResolver } from './contact/contact';

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
    path: 'scholarships',
    resolve: { data: scholarshipsResolver },
    loadComponent: () => import('./scholarships/scholarships').then((m) => m.ScholarshipsPage),
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
  {
    path: 'documents',
    resolve: { data: documentsResolver },
    loadComponent: () => import('./documents/documents').then((m) => m.DocumentsPage),
  },
  {
    path: 'contact',
    resolve: { data: contactResolver },
    loadComponent: () => import('./contact/contact').then((m) => m.ContactPage),
  },
];
