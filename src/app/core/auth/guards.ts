import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LocaleService } from '../i18n/locale.service';
import { ApplicantSessionStore } from './applicant-session.store';
import { StaffSessionStore } from './staff-session.store';

// Note: every inject() happens before the first await (injection context ends at the await).

/** Staff-only routes. Anonymous → `/:lang/admin/login?returnUrl=`. */
export const staffGuard: CanActivateFn = async (_route, state) => {
  const store = inject(StaffSessionStore);
  const router = inject(Router);
  const locale = inject(LocaleService);
  if (await store.ensureLoaded()) {
    return true;
  }
  return router.createUrlTree([locale.link('/admin/login')], { queryParams: { returnUrl: state.url } });
};

/**
 * Role check against the runtime matrix (`GET /admin/roles`, B17). Route data: `{ area: 'news' }`.
 * Not allowed → the "no access" page (403 state), never a silent redirect home.
 */
export const roleGuard: CanActivateFn = async (route) => {
  const store = inject(StaffSessionStore);
  const router = inject(Router);
  const locale = inject(LocaleService);
  await store.ensureLoaded();
  const area = route.data['area'] as string | undefined;
  if (!area || store.can(area)) {
    return true;
  }
  return router.createUrlTree([locale.link('/admin/forbidden')]);
};

/** Signed-in staff skip the login page. */
export const staffLoginGuard: CanActivateFn = async () => {
  const store = inject(StaffSessionStore);
  const router = inject(Router);
  const locale = inject(LocaleService);
  return (await store.ensureLoaded()) ? router.createUrlTree([locale.link('/admin')]) : true;
};

/** Applicant-only portal routes. Anonymous → `/:lang/portal/login?returnUrl=`. */
export const applicantGuard: CanActivateFn = async (_route, state) => {
  const store = inject(ApplicantSessionStore);
  const router = inject(Router);
  const locale = inject(LocaleService);
  if (await store.ensureLoaded()) {
    return true;
  }
  return router.createUrlTree([locale.link('/portal/login')], { queryParams: { returnUrl: state.url } });
};
