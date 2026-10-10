import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ARGON2_OPTIONS,
  E2E_EMAIL_DOMAIN,
  hashToken,
  newRawToken,
  seedStaff,
  seededIdentity,
  TOKEN_TTL,
} from './real-db';

const snapshot = (path: string) => readFileSync(`docs/api/src/${path}`, 'utf8');

describe('real-db (Stage 2 real-API e2e support)', () => {
  it('uses the API argon2 cost (drift check against the rc1 snapshot)', () => {
    const src = snapshot('auth/argon2-options.ts');
    expect(src).toMatch(/type:\s*argon2\.argon2id/);
    const num = (key: string) =>
      Number(new RegExp(`${key}:\\s*([\\d_]+)`).exec(src)?.[1]?.replace(/_/g, ''));
    expect(ARGON2_OPTIONS).toEqual({
      memoryCost: num('memoryCost'),
      timeCost: num('timeCost'),
      parallelism: num('parallelism'),
    });
  });

  it('hashes tokens like session-token.util.ts (sha256 hex of the raw base64url value)', () => {
    expect(snapshot('auth/session-token.util.ts')).toMatch(
      /createHash\('sha256'\)[\s\S]*digest\('hex'\)/,
    );
    const raw = newRawToken();
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken(raw)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('keeps invite 48 h and reset 60 min', () => {
    expect(TOKEN_TTL).toEqual({ invite: 'INTERVAL 48 HOUR', reset: 'INTERVAL 60 MINUTE' });
  });

  it('only ever seeds @e2e.invalid identities with a name', () => {
    const who = seededIdentity('reviewer', 'ab12');
    expect(who).toEqual({
      name: 'E2E reviewer ab12',
      email: `e2e-reviewer-ab12@${E2E_EMAIL_DOMAIN}`,
    });
  });

  it('refuses to touch a database without E2E_API_URL', async () => {
    if (process.env['E2E_API_URL']) return;
    await expect(seedStaff('admin')).rejects.toThrow(/E2E_API_URL/);
  });
});
