import { describe, expect, it } from 'vitest';
import {
  issueNewsletterToken,
  verifyNewsletterToken,
} from '../../docs/api/src/contact/newsletter-token.util';
import { apiEnv } from '../../scripts/api-env.mjs';
import { issue } from './newsletter-token';

describe('newsletter token (drift vs safeer_api rc1 newsletter-token.util.ts)', () => {
  const key = apiEnv().APP_ENCRYPTION_KEY;
  const now = 1_790_000_000_000;

  it('signs exactly like the API', () => {
    for (const action of ['confirm', 'unsubscribe'] as const) {
      expect(issue(key, action, ' Reader@Example.invalid ', now)).toBe(
        issueNewsletterToken(key, action, ' Reader@Example.invalid ', now),
      );
    }
  });

  it('is accepted by the API verifier', () => {
    const token = issue(key, 'confirm', 'reader@example.invalid', now);
    expect(verifyNewsletterToken(key, 'confirm', 'reader@example.invalid', token, now + 1000)).toBe(
      true,
    );
  });
});
