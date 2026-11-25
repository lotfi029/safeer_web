/**
 * Permission rules of the mock API, the same as safeer_api v1.1.0 (src/auth/permissions.ts and the
 * `@Permission()` on each admin route): a route needs `<module>.<action>`, the module from its path
 * and the action from its method (GET → view, POST/PATCH/PUT → manage, DELETE → delete). Routes open
 * to any signed-in staff member (admin/me, admin/auth/*, admin/overview, admin/permissions) need
 * none; the invite needs users.manage and a message → testimonial conversion also needs
 * testimonials.manage.
 */

/** First path segment under /admin/ → permission module. */
const MODULE_FOR_SEGMENT = {
  pages: 'pages',
  'page-sections': 'pages',
  news: 'news',
  'news-categories': 'news',
  'preview-token': 'news',
  'work-areas': 'workAreas',
  'work-area-items': 'workAreas',
  board: 'board',
  'org-positions': 'orgChart',
  partners: 'partners',
  documents: 'documents',
  'doc-categories': 'documents',
  licences: 'licences',
  stats: 'stats',
  'about-items': 'aboutItems',
  media: 'media',
  redirects: 'redirects',
  messages: 'messages',
  testimonials: 'testimonials',
  'testimonial-themes': 'testimonials',
  newsletter: 'newsletter',
  users: 'users',
  roles: 'roles',
  settings: 'settings',
  cache: 'settings',
  mail: 'mail',
  audit: 'audit',
};

const ACTION_FOR_METHOD = {
  GET: 'view',
  POST: 'manage',
  PATCH: 'manage',
  PUT: 'manage',
  DELETE: 'delete',
};
export const ACTIONS = ['view', 'manage', 'delete'];
export const WILDCARD = '*';

/**
 * The permission keys a request needs (empty: any signed-in staff member).
 * @param {string} method
 * @param {string} path the URL path, e.g. `/api/v1/admin/news/12`
 * @returns {string[]}
 */
export function permissionsFor(method, path) {
  const rel = path.replace(/^\/api\/v1\/admin\/?/, '');
  if (/^(me|overview|permissions)$/.test(rel)) return [];
  if (rel === 'auth/invite') return ['users.manage'];
  if (/^auth(\/|$)/.test(rel)) return [];
  // users/assignable-roles: users.view (GET), like every other users route.
  const module = MODULE_FOR_SEGMENT[rel.split('/')[0]];
  if (!module) return [];
  const action = ACTION_FOR_METHOD[method] ?? 'view';
  const keys = [`${module}.${action}`];
  if (/^messages\/[^/]+\/convert-to-testimonial$/.test(rel)) keys.push('testimonials.manage');
  return keys;
}

/** @param {Set<string>|string[]} held @param {string} key */
export function can(held, key) {
  const set = held instanceof Set ? held : new Set(held);
  return set.has(WILDCARD) || set.has(key);
}

/** Whether `held` covers every key of `target` (no escalation; a `*` target needs a `*` holder). */
export function isSubset(held, target) {
  const set = held instanceof Set ? held : new Set(held);
  if (set.has(WILDCARD)) return true;
  return [...target].every((k) => set.has(k));
}

/**
 * Validates keys against the catalog and closes them under delete ⇒ manage ⇒ view (where the module
 * has them), in catalog order. Returns `{ keys }` or `{ unknown }`.
 */
export function normalise(keys, catalog) {
  const modules = new Map(catalog.groups.flatMap((g) => g.modules.map((m) => [m.key, m.actions])));
  const all = [...modules].flatMap(([m, actions]) => actions.map((a) => `${m}.${a}`));
  const known = new Set(all);
  const unknown = keys.filter((k) => !known.has(k));
  if (unknown.length) return { unknown: [...new Set(unknown)] };
  const out = new Set(keys);
  for (const key of keys) {
    const dot = key.lastIndexOf('.');
    const module = key.slice(0, dot);
    const idx = ACTIONS.indexOf(key.slice(dot + 1));
    for (const a of ACTIONS.slice(0, idx))
      if (modules.get(module).includes(a)) out.add(`${module}.${a}`);
  }
  return { keys: all.filter((k) => out.has(k)) };
}
