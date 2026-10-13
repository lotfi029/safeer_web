import type { StaffRole } from '../api/models';

/**
 * Area keys of the real role matrix (`GET /admin/roles`, B17; safeer_api `src/auth/role-matrix.ts`,
 * snapshot in docs/api/src/auth/role-matrix.ts). Route data uses these: `{ area: 'content' }`.
 */
export type StaffArea =
  'content' | 'redirects.delete' | 'inbox' | 'inbox.delete' | 'users' | 'settings' | 'audit';

/**
 * Typed fallback for the role matrix, a copy of the API's `AREA_ROLES`. The runtime source of truth
 * is `GET /admin/roles`; this copy is used only if that call fails. Never hard-code roles into menus:
 * read `StaffSessionStore.can(area)`.
 *
 * - `content`: pages/sections, news + categories, work areas, board, stats, about items, partners,
 *   documents, licences, media, redirects
 * - `inbox`: contact messages, testimonials + themes, newsletter subscribers (A5: also the overview's
 *   message counts, so editors never see them)
 * - `settings`: site settings, mail settings/templates/logs, cache
 * - `*.delete`: the destructive actions inside an area, admin-only
 */
export const ROLE_MATRIX: Readonly<Record<StaffArea, readonly StaffRole[]>> = {
  content: ['admin', 'editor'],
  'redirects.delete': ['admin'],
  inbox: ['admin', 'support'],
  'inbox.delete': ['admin'],
  users: ['admin'],
  settings: ['admin'],
  audit: ['admin'],
};
