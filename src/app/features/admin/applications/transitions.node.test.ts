import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_STATUS_TRANSITIONS,
  REQUEST_DOCUMENTS_ALLOWED_FROM,
  SETTABLE_STATUSES,
} from './transitions';

/** Evaluates a `{ ... }` / `[ ... ]` literal copied out of the API source (plain data, no code). */
function literal(src: string, name: string): unknown {
  const start = src.indexOf(`const ${name}`);
  const body = src.slice(src.indexOf('=', start) + 1);
  const end = body.indexOf(';');
  return Function(`"use strict"; return (${body.slice(0, end).replace(/as const/, '')});`)();
}

describe('application transitions (drift vs safeer_api rc1)', () => {
  const src = readFileSync('docs/api/src/admin-applications/transitions.ts', 'utf8');

  it('matches APPLICATION_STATUS_TRANSITIONS', () => {
    expect(APPLICATION_STATUS_TRANSITIONS).toEqual(literal(src, 'APPLICATION_STATUS_TRANSITIONS'));
  });

  it('matches REQUEST_DOCUMENTS_ALLOWED_FROM', () => {
    expect(REQUEST_DOCUMENTS_ALLOWED_FROM).toEqual(literal(src, 'REQUEST_DOCUMENTS_ALLOWED_FROM'));
  });

  it('only offers statuses the update DTO accepts', () => {
    const dto = readFileSync(
      'docs/api/src/admin-applications/dto/update-application.dto.ts',
      'utf8',
    );
    const settable = literal(dto, 'ADMIN_SETTABLE_STATUSES') as string[];
    for (const status of SETTABLE_STATUSES) expect(settable).toContain(status);
  });
});
