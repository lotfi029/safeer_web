/**
 * The staff permission keys (safeer_api v1.1.0, `src/auth/permissions.ts`; snapshot in
 * docs/api/src/auth/permissions.ts, drift-tested by permissions.spec.ts). A key is
 * `<module>.<action>`: `view` (list and read), `manage` (create, edit, publish, reorder, upload),
 * `delete`. Each module has only the actions its routes have (audit: view; mail: view and manage;
 * newsletter: view and delete).
 *
 * The runtime source is `GET /admin/me` → `permissions` (`["*"]` for admin); there is no fallback
 * matrix. Route data and nav items name the key they need: `{ permission: 'news.view' }`.
 */
export const PERMISSION_MODULES = {
  pages: ['view', 'manage', 'delete'],
  news: ['view', 'manage', 'delete'],
  workAreas: ['view', 'manage', 'delete'],
  board: ['view', 'manage', 'delete'],
  orgChart: ['view', 'manage', 'delete'],
  partners: ['view', 'manage', 'delete'],
  documents: ['view', 'manage', 'delete'],
  licences: ['view', 'manage', 'delete'],
  stats: ['view', 'manage', 'delete'],
  aboutItems: ['view', 'manage', 'delete'],
  media: ['view', 'manage', 'delete'],
  redirects: ['view', 'manage', 'delete'],
  messages: ['view', 'manage', 'delete'],
  testimonials: ['view', 'manage', 'delete'],
  newsletter: ['view', 'delete'],
  users: ['view', 'manage', 'delete'],
  roles: ['view', 'manage', 'delete'],
  settings: ['view', 'manage', 'delete'],
  mail: ['view', 'manage'],
  audit: ['view'],
} as const;

export type PermissionModule = keyof typeof PERMISSION_MODULES;
export type PermissionAction = 'view' | 'manage' | 'delete';
export type PermissionKey = {
  [M in PermissionModule]: `${M}.${(typeof PERMISSION_MODULES)[M][number]}`;
}[PermissionModule];

/** Held by the `admin` role: every permission. */
export const WILDCARD = '*';

/** `module.action` when the module has that action, else null (newsletter has no `manage`). */
export function permissionKey(
  module: PermissionModule,
  action: PermissionAction,
): PermissionKey | null {
  return (PERMISSION_MODULES[module] as readonly string[]).includes(action)
    ? (`${module}.${action}` as PermissionKey)
    : null;
}

/** `*` holds everything; otherwise an exact match. */
export function holds(permissions: ReadonlySet<string>, key: PermissionKey): boolean {
  return permissions.has(WILDCARD) || permissions.has(key);
}
