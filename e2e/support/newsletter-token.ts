import { createHmac, hkdfSync } from 'node:crypto';
import { apiEnv } from '../../scripts/api-env.mjs';
import { usingMockApi } from './env';

export type NewsletterAction = 'confirm' | 'unsubscribe';

const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The signed token a newsletter mail carries, made the way safeer_api's `issueNewsletterToken` makes it
 * (contact/newsletter-token.util.ts: HMAC-SHA256 under an HKDF key from APP_ENCRYPTION_KEY; drift-
 * tested against the rc1 snapshot). The e2e API runs with the key from scripts/api-env.mjs. The mock
 * accepts its fixed `mock-token`.
 */
export function newsletterToken(
  action: NewsletterAction,
  email: string,
  appKey = apiEnv().APP_ENCRYPTION_KEY,
  now = Date.now(),
): string {
  if (usingMockApi) return 'mock-token';
  return issue(appKey, action, email, now);
}

export function issue(
  appKey: string,
  action: NewsletterAction,
  email: string,
  now = Date.now(),
): string {
  const key = Buffer.from(
    hkdfSync('sha256', Buffer.from(appKey, 'base64'), Buffer.alloc(0), 'safeer-newsletter-v1', 32),
  );
  const sign = (expiresAtMs: number | null) =>
    createHmac('sha256', key)
      .update(`${action}|${email.trim().toLowerCase()}|${expiresAtMs ?? ''}`)
      .digest('base64url');
  if (action === 'unsubscribe') return sign(null);
  const expiresAtMs = now + CONFIRM_TTL_MS;
  return `${expiresAtMs}.${sign(expiresAtMs)}`;
}
