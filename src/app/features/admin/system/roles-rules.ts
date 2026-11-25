/** Role editor rules shared with the API (pure: no Angular, so node drift tests can import it). */
export type Action = 'view' | 'manage' | 'delete';
export const ACTIONS: readonly Action[] = ['view', 'manage', 'delete'];

/** safeer_api src/roles/dto/role.dto.ts (R9): the key pattern and the reserved keys. */
export const ROLE_KEY_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
export const RESERVED_ROLE_KEYS: readonly string[] = [
  'admin',
  'editor',
  'support',
  'owner',
  'root',
  'system',
];

/**
 * The grid's rule, the API's own (`normalisePermissions`): ticking an action ticks the ones it implies
 * (delete ⇒ manage ⇒ view, where the module has them); clearing one clears the ones that imply it
 * (clearing view clears the row). Returns the new set.
 */
export function toggleAction(
  current: ReadonlySet<string>,
  module: string,
  actions: readonly Action[],
  action: Action,
  on: boolean,
): Set<string> {
  const next = new Set(current);
  const idx = ACTIONS.indexOf(action);
  const affected = on ? ACTIONS.slice(0, idx + 1) : ACTIONS.slice(idx);
  for (const a of affected) {
    if (!actions.includes(a)) continue;
    if (on) next.add(`${module}.${a}`);
    else next.delete(`${module}.${a}`);
  }
  return next;
}
