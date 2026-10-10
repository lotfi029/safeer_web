import { describe, expect, it } from 'vitest';
import { apiEnv, FRONTEND_ORIGIN } from './real-api.mjs';

describe('real-api apiEnv (W24)', () => {
  it('runs the API as NODE_ENV=test so per-IP throttles do not break e2e', () => {
    expect(apiEnv({}).NODE_ENV).toBe('test');
  });

  it('points emailed links and CORS at the e2e SSR origin', () => {
    const env = apiEnv({});
    expect(env.FRONTEND_BASE_URL).toBe(FRONTEND_ORIGIN);
    expect(env.CORS_ORIGINS).toBe(FRONTEND_ORIGIN);
  });

  it('defaults to the CI MySQL service and lets the caller override the database', () => {
    expect(apiEnv({})).toMatchObject({
      DB_HOST: '127.0.0.1',
      DB_PORT: '3306',
      DB_USER: 'root',
      DB_PASSWORD: '',
      DB_NAME: 'safeer',
      PORT: '3900',
    });
    expect(apiEnv({ DB_PORT: '3307', DB_PASSWORD: 'x', API_PORT: '3901' })).toMatchObject({
      DB_PORT: '3307',
      DB_PASSWORD: 'x',
      PORT: '3901',
    });
  });

  it('carries a 32-byte base64 encryption key (the API refuses to boot otherwise)', () => {
    expect(Buffer.from(apiEnv({}).APP_ENCRYPTION_KEY, 'base64')).toHaveLength(32);
  });
});
