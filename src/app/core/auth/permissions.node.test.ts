import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { holds, PERMISSION_MODULES, permissionKey } from './permissions';

/** The API's catalog (safeer_api src/auth/permissions.ts in the docs/api snapshot), parsed from source. */
function apiCatalog(): Record<string, string[]> {
  const src = readFileSync('docs/api/src/auth/permissions.ts', 'utf8');
  const out: Record<string, string[]> = {};
  for (const m of src.matchAll(
    /\{ key: '(\w+)', labelAr: '[^']*', labelEn: '[^']*', actions: ([^}]+) \}/g,
  )) {
    const actions =
      m[2].trim() === 'VMD'
        ? ['view', 'manage', 'delete']
        : [...m[2].matchAll(/'(\w+)'/g)].map((a) => a[1]);
    out[m[1]] = actions;
  }
  return out;
}

describe('permission keys (drift check against the v1.1.0 snapshot)', () => {
  it('mirror the API catalog module by module, actions included', () => {
    const api = apiCatalog();
    expect(Object.keys(api).length).toBeGreaterThan(15);
    expect(
      Object.fromEntries(Object.entries(PERMISSION_MODULES).map(([k, v]) => [k, [...v]])),
    ).toEqual(api);
  });

  it('builds keys only for actions a module has', () => {
    expect(permissionKey('news', 'delete')).toBe('news.delete');
    expect(permissionKey('newsletter', 'manage')).toBeNull();
    expect(permissionKey('audit', 'manage')).toBeNull();
  });

  it('treats * as every permission', () => {
    expect(holds(new Set(['*']), 'users.delete')).toBe(true);
    expect(holds(new Set(['news.view']), 'news.view')).toBe(true);
    expect(holds(new Set(['news.view']), 'news.manage')).toBe(false);
  });
});

describe('role key rules (drift check against src/roles/dto/role.dto.ts)', () => {
  it('match the API pattern and reserved keys', async () => {
    const src = readFileSync('docs/api/src/roles/dto/role.dto.ts', 'utf8');
    const { ROLE_KEY_PATTERN, RESERVED_ROLE_KEYS } =
      await import('../../features/admin/system/roles-rules');
    expect(src).toContain(`ROLE_KEY_PATTERN = ${ROLE_KEY_PATTERN.toString()};`);
    const reserved = /RESERVED_ROLE_KEYS[^=]*= \[([^\]]*)\]/.exec(src)?.[1] ?? '';
    expect([...reserved.matchAll(/'([a-z]+)'/g)].map((m) => m[1])).toEqual([...RESERVED_ROLE_KEYS]);
  });
});
