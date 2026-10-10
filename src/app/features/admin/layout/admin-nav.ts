import { computed, inject, Injectable } from '@angular/core';
import { StaffSessionStore } from '../../../core/auth/staff-session.store';
import type { StaffArea } from '../../../core/auth/role-matrix';
import { LocaleService } from '../../../core/i18n/locale.service';
import type { IconName } from '../../../shared/ui/icon/icon-names';
import { AdminBadges } from './admin-badges';

export interface AdminNavItem {
  /** Path under `/:lang/admin` ('' is the overview). */
  path: string;
  /** Key under `admin.shell.items`. */
  label: string;
  icon: IconName;
  /** Role-matrix area; no area = any staff member. */
  area?: StaffArea;
  badge?: 'newApplications' | 'unreadMessages';
  exact?: boolean;
}

export interface AdminNavGroup {
  /** Key under `admin.shell.groups`. */
  label: string;
  items: AdminNavItem[];
}

/** Sidebar groups (prototype `ANAV`), filtered by `GET /admin/roles`: never by hard-coded roles. */
export const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    label: 'main',
    items: [
      { path: '', label: 'overview', icon: 'layout-dashboard', exact: true },
      {
        path: 'applications',
        label: 'applications',
        icon: 'file-text',
        area: 'applications',
        badge: 'newApplications',
      },
      {
        path: 'messages',
        label: 'messages',
        icon: 'mail',
        area: 'inbox',
        badge: 'unreadMessages',
      },
    ],
  },
];

export interface ResolvedNavItem extends AdminNavItem {
  link: string;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class AdminNav {
  private readonly store = inject(StaffSessionStore);
  private readonly locale = inject(LocaleService);
  private readonly badges = inject(AdminBadges);

  readonly groups = computed(() => {
    // Read the signals the filter depends on so the menu follows role and matrix changes.
    this.store.role();
    this.store.matrix();
    const counts = this.badges.counts();
    return ADMIN_NAV.map((group) => ({
      label: group.label,
      items: group.items
        .filter((item) => !item.area || this.store.can(item.area))
        .map<ResolvedNavItem>((item) => ({
          ...item,
          link: this.locale.link(`/admin${item.path ? `/${item.path}` : ''}`),
          count: item.badge ? (counts[item.badge] ?? 0) : 0,
        })),
    })).filter((group) => group.items.length);
  });
}
