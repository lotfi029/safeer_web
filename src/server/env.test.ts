import { describe, expect, it } from 'vitest';
import { allowedHostsFor, EnvError, parseEnv } from './env';

describe('parseEnv', () => {
  it('uses local defaults in development', () => {
    const env = parseEnv({}, true);
    expect(env.isProduction).toBe(false);
    expect(env.apiInternalUrl).toBe('http://127.0.0.1:3000');
    expect(env.port).toBe(4000);
    expect(env.trustProxy).toBe(1);
    expect(env.allowedHosts).toContain('localhost');
  });

  it('fails fast in production when required variables are missing (R5 fail closed)', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' }, true)).toThrow(EnvError);
    expect(() =>
      parseEnv({ NODE_ENV: 'production', API_INTERNAL_URL: 'http://127.0.0.1:3000' }, true),
    ).toThrow(/PUBLIC_SITE_URL/);
  });

  it('does not throw in non-strict mode (ng serve / build)', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' }, false)).not.toThrow();
  });

  it('normalises URLs to origins and validates numbers', () => {
    const env = parseEnv(
      {
        NODE_ENV: 'production',
        API_INTERNAL_URL: 'http://127.0.0.1:3000/',
        PUBLIC_SITE_URL: 'https://safeer-sa.org/ar',
        PORT: '8080',
        TRUST_PROXY: '2',
      },
      true,
    );
    expect(env.apiInternalUrl).toBe('http://127.0.0.1:3000');
    expect(env.publicSiteUrl).toBe('https://safeer-sa.org');
    expect(env.port).toBe(8080);
    expect(env.trustProxy).toBe(2);
    expect(() => parseEnv({ PORT: 'abc' }, true)).toThrow(/PORT/);
    expect(() => parseEnv({ API_INTERNAL_URL: 'ftp://x' }, true)).toThrow(/http or https/);
    expect(() => parseEnv({ TRUST_PROXY: '99' }, true)).toThrow(/TRUST_PROXY/);
  });
});

describe('allowedHostsFor (R5)', () => {
  it('allows apex + www in production only', () => {
    expect(allowedHostsFor('https://safeer-sa.org', true).sort()).toEqual([
      'safeer-sa.org',
      'www.safeer-sa.org',
    ]);
    expect(allowedHostsFor('https://www.safeer-sa.org', true).sort()).toEqual([
      'safeer-sa.org',
      'www.safeer-sa.org',
    ]);
  });
  it('adds localhost outside production', () => {
    expect(allowedHostsFor('https://safeer-sa.org', false)).toEqual(
      expect.arrayContaining(['safeer-sa.org', 'www.safeer-sa.org', 'localhost', '127.0.0.1']),
    );
  });
  it('does not invent a www host for localhost or IPs', () => {
    expect(allowedHostsFor('http://localhost:4100', true)).toEqual(['localhost']);
    expect(allowedHostsFor('http://10.0.0.5:4000', true)).toEqual(['10.0.0.5']);
  });
});
