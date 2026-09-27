import { describe, expect, it } from 'vitest';
import recorded from './fixtures/admin-shapes.json' with { type: 'json' };
import { ADMIN_SHAPES, shapeDiff, shapeOf } from '../scripts/record-admin-shapes.mjs';
import { createMockBackend } from './backend.mjs';
import { fixtures } from './fixtures.mjs';

/**
 * The mock's admin responses have the shapes recorded from safeer_api rc1
 * (scripts/record-admin-shapes.mjs → fixtures/admin-shapes.json).
 */
describe('mock admin responses match the recorded rc1 shapes', () => {
  const backend = createMockBackend(fixtures);
  const login = backend.handle({
    method: 'POST',
    url: '/api/v1/admin/auth/login',
    headers: {},
    body: { email: 'admin@mock.invalid', password: 'mock-password' },
  });
  const sid = /sf_sid=([^;]+)/.exec(login.headers['set-cookie'])[1];
  const headers = { cookie: `sf_sid=${sid}`, 'x-csrf-token': login.body.csrfToken };
  backend.handle({
    method: 'POST',
    url: '/api/v1/contact?lang=ar',
    headers: {},
    body: {
      name: 'Sender',
      email: 'a@example.invalid',
      subject: 'other',
      body: '[...]',
      formRenderedAt: 1,
    },
  });
  const messageId = backend.db.messages[0].id;
  const ids = { application: '101', message: messageId };

  for (const [name, template] of Object.entries(ADMIN_SHAPES)) {
    it(name, () => {
      expect(recorded[name], `${name} is recorded`).toBeDefined();
      const url = `/api/v1${template.replace(/\{(\w+)\}/g, (_, k) => ids[k])}`;
      const res = backend.handle({ method: 'GET', url, headers });
      expect(res.status).toBe(200);
      expect(shapeDiff(shapeOf(res.body), recorded[name])).toEqual([]);
    });
  }
});
