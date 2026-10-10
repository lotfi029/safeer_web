import { describe, expect, it } from 'vitest';
import { collapseBilingual } from './collapse.mjs';
import { fixtures } from './fixtures.mjs';

describe('mock fixtures keep the real response shapes', () => {
  it('GET /board is grouped as { board, executive } (W1)', () => {
    const res = collapseBilingual(fixtures.board, 'en');
    expect(Object.keys(res).sort()).toEqual(['board', 'executive']);
    for (const grp of ['board', 'executive']) {
      expect(res[grp].length).toBeGreaterThan(0);
      for (const m of res[grp]) {
        expect(m.grp).toBe(grp);
        expect(typeof m.name).toBe('string');
        expect(typeof m.role).toBe('string');
      }
    }
    expect(res.board.filter((m) => m.isLead)).toHaveLength(1);
  });
});
