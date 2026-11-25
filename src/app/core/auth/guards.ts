import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LocaleService } from '../i18n/locale.service';
import type { PermissionKey } from './permissions';
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
  return router.createUrlTree([locale.link('/admin/login')], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Permission check against `GET /admin/me` → `permissions` (safeer_api v1.1.0). Route data:
 * `{ permission: 'news.view' }` (`PermissionKey`; none = any staff member). Not allowed → the
 * "no access" page (403 state), never a silent redirect home.
 */
export const permissionGuard: CanActivateFn = async (route) => {
  const store = inject(StaffSessionStore);
  const router = inject(Router);
  const locale = inject(LocaleService);
  await store.ensureLoaded();
  const permission = route.data['permission'] as PermissionKey | undefined;
  if (!permission || store.can(permission)) {
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
