import { computed, inject, Injectable } from '@angular/core';
import { StaffSessionStore } from '../../../core/auth/staff-session.store';
import type { PermissionKey } from '../../../core/auth/permissions';
import { LocaleService } from '../../../core/i18n/locale.service';
import type { IconName } from '../../../shared/ui/icon/icon-names';
import { AdminBadges } from './admin-badges';

export interface AdminNavItem {
  /** Path under `/:lang/admin` ('' is the overview). */
  path: string;
  /** Key under `admin.shell.items`. */
  label: string;
  icon: IconName;
  /** The `<module>.view` permission the screen needs; none = any staff member. */
  permission?: PermissionKey;
  badge?: 'unreadMessages';
  exact?: boolean;
}

export interface AdminNavGroup {
  /** Key under `admin.shell.groups`. */
  label: string;
  items: AdminNavItem[];
}

/** Sidebar groups (prototype `ANAV`), filtered by `GET /admin/me` → `permissions`: never by role names. */
export const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    label: 'main',
    items: [
      { path: '', label: 'overview', icon: 'layout-dashboard', exact: true },
      {
        path: 'messages',
        label: 'messages',
        icon: 'mail',
        permission: 'messages.view',
        badge: 'unreadMessages',
      },
      {
        path: 'newsletter',
        label: 'newsletter',
        icon: 'mail-check',
        permission: 'newsletter.view',
      },
    ],
  },
  {
    label: 'content',
    items: [
      { path: 'pages', label: 'pages', icon: 'panels-top-left', permission: 'pages.view' },
      { path: 'news', label: 'news', icon: 'newspaper', permission: 'news.view' },
      { path: 'work-areas', label: 'workAreas', icon: 'target', permission: 'workAreas.view' },
      { path: 'board', label: 'board', icon: 'users', permission: 'board.view' },
      { path: 'org-chart', label: 'orgChart', icon: 'building-2', permission: 'orgChart.view' },
      {
        path: 'testimonials',
        label: 'testimonials',
        icon: 'quote',
        permission: 'testimonials.view',
      },
      { path: 'partners', label: 'partners', icon: 'handshake', permission: 'partners.view' },
      { path: 'documents', label: 'documents', icon: 'folder', permission: 'documents.view' },
      { path: 'licences', label: 'licences', icon: 'badge-check', permission: 'licences.view' },
      { path: 'stats', label: 'stats', icon: 'chart-column', permission: 'stats.view' },
      {
        path: 'about-items',
        label: 'aboutItems',
        icon: 'list-checks',
        permission: 'aboutItems.view',
      },
      { path: 'media', label: 'media', icon: 'image', permission: 'media.view' },
      {
        path: 'redirects',
        label: 'redirects',
        icon: 'corner-up-right',
        permission: 'redirects.view',
      },
    ],
  },
  {
    label: 'system',
    items: [
      { path: 'system/users', label: 'users', icon: 'user-cog', permission: 'users.view' },
      { path: 'system/roles', label: 'roles', icon: 'shield-check', permission: 'roles.view' },
      { path: 'system/settings', label: 'settings', icon: 'settings', permission: 'settings.view' },
      { path: 'system/mail', label: 'mail', icon: 'mail', permission: 'mail.view' },
      { path: 'system/audit', label: 'audit', icon: 'history', permission: 'audit.view' },
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
    // Read the signal the filter depends on so the menu follows a permission change.
    this.store.permissions();
    const counts = this.badges.counts();
    return ADMIN_NAV.map((group) => ({
      label: group.label,
      items: group.items
        .filter((item) => !item.permission || this.store.can(item.permission))
        .map<ResolvedNavItem>((item) => ({
          ...item,
          link: this.locale.link(`/admin${item.path ? `/${item.path}` : ''}`),
          count: item.badge ? (counts[item.badge] ?? 0) : 0,
        })),
    })).filter((group) => group.items.length);
  });
}
