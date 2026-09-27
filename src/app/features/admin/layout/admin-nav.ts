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
        path: 'interview-slots',
        label: 'interviewSlots',
        icon: 'calendar-check',
        area: 'applications',
      },
      {
        path: 'messages',
        label: 'messages',
        icon: 'mail',
        area: 'inbox',
        badge: 'unreadMessages',
      },
      { path: 'newsletter', label: 'newsletter', icon: 'mail-check', area: 'inbox' },
    ],
  },
  {
    label: 'content',
    items: [
      { path: 'pages', label: 'pages', icon: 'panels-top-left', area: 'content' },
      { path: 'news', label: 'news', icon: 'newspaper', area: 'content' },
      { path: 'work-areas', label: 'workAreas', icon: 'target', area: 'content' },
      { path: 'board', label: 'board', icon: 'users', area: 'content' },
      { path: 'testimonials', label: 'testimonials', icon: 'quote', area: 'inbox' },
      { path: 'partners', label: 'partners', icon: 'handshake', area: 'content' },
      { path: 'documents', label: 'documents', icon: 'folder', area: 'content' },
      { path: 'stats', label: 'stats', icon: 'chart-column', area: 'content' },
      { path: 'about-items', label: 'aboutItems', icon: 'list-checks', area: 'content' },
      { path: 'media', label: 'media', icon: 'image', area: 'content' },
      { path: 'redirects', label: 'redirects', icon: 'corner-up-right', area: 'content' },
    ],
  },
  {
    label: 'system',
    items: [
      { path: 'system/users', label: 'users', icon: 'user-cog', area: 'users' },
      { path: 'system/settings', label: 'settings', icon: 'settings', area: 'settings' },
      { path: 'system/mail', label: 'mail', icon: 'mail', area: 'settings' },
      { path: 'system/sms', label: 'sms', icon: 'smartphone', area: 'settings' },
      { path: 'system/audit', label: 'audit', icon: 'history', area: 'audit' },
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
