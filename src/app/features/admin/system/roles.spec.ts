import { RESERVED_ROLE_KEYS, ROLE_KEY_PATTERN, toggleAction } from './roles-rules';

const VMD = ['view', 'manage', 'delete'] as const;

describe('role editor grid (v1.1.0)', () => {
  it('ticking delete ticks manage and view; ticking manage ticks view', () => {
    expect([...toggleAction(new Set(), 'news', VMD, 'delete', true)].sort()).toEqual([
      'news.delete',
      'news.manage',
      'news.view',
    ]);
    expect([...toggleAction(new Set(), 'pages', VMD, 'manage', true)].sort()).toEqual([
      'pages.manage',
      'pages.view',
    ]);
  });

  it('clearing view clears the row; clearing manage clears delete', () => {
    const all = new Set(['news.view', 'news.manage', 'news.delete', 'pages.view']);
    expect([...toggleAction(all, 'news', VMD, 'view', false)]).toEqual(['pages.view']);
    expect([...toggleAction(all, 'news', VMD, 'manage', false)].sort()).toEqual([
      'news.view',
      'pages.view',
    ]);
  });

  it('only touches actions the module has (newsletter: view, delete)', () => {
    expect(
      [...toggleAction(new Set(), 'newsletter', ['view', 'delete'], 'delete', true)].sort(),
    ).toEqual(['newsletter.delete', 'newsletter.view']);
  });

  it('checks keys like the API (R9)', () => {
    expect(ROLE_KEY_PATTERN.test('news-writer')).toBe(true);
    for (const bad of ['ab', 'News', '1role', 'has space', 'x'.repeat(65)]) {
      expect(ROLE_KEY_PATTERN.test(bad)).toBe(false);
    }
    expect(RESERVED_ROLE_KEYS).toContain('admin');
  });
});
