/**
 * The real API's e2e environment, shared by scripts/real-api.mjs (which boots the API with it) and
 * e2e/support/real-db.ts (which connects to the same database). No top-level await, so the
 * Playwright TS loader can require it.
 */
/** The e2e SSR origin (playwright.config.ts): emailed links and CORS point here. */
export const FRONTEND_ORIGIN = 'http://localhost:4100';

/**
 * The API's environment. Values mirror safeer_api's own CI job (none are real secrets: CI-only, no
 * production data ever touches these databases).
 */
export function apiEnv(env = process.env) {
  return {
    NODE_ENV: 'test',
    PORT: env.API_PORT || '3900',
    DB_HOST: env.DB_HOST || '127.0.0.1',
    DB_PORT: env.DB_PORT || '3306',
    DB_USER: env.DB_USER || 'root',
    DB_PASSWORD: env.DB_PASSWORD ?? '',
    DB_NAME: env.DB_NAME || 'safeer',
    SESSION_COOKIE_NAME: 'sf_sid',
    SESSION_IDLE_HOURS: '8',
    SESSION_ABSOLUTE_DAYS: '30',
    APP_ENCRYPTION_KEY: 'ukhiU9W4qpmJr9pwnzL01FaECwZTTOF3Y2vPKga7xrk=',
    STORAGE_DRIVER: 'local',
    STORAGE_ROOT: './var/assets',
    BOOTSTRAP_ADMIN_EMAIL: 'admin@safeer-sa.org',
    BOOTSTRAP_ADMIN_PASSWORD: 'ci-only-password-not-a-secret',
    IP_HASH_SALT: 'ci-only-salt-not-a-secret',
    CORS_ORIGINS: FRONTEND_ORIGIN,
    FRONTEND_BASE_URL: FRONTEND_ORIGIN,
    CACHE_TTL_SECONDS: '60',
    CACHE_MAX_ENTRIES: '500',
    ALLOW_DEV_PASSWORD_FIXUP: 'true',
  };
}
