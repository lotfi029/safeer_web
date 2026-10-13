import type { ContentRow } from '../../../../core/api/admin/content-api';
import { flattenTree, parentOptions, previewForest, resolveTone } from './org-tree';

const row = (id: string, parentId: string | null, extra: Record<string, unknown> = {}) =>
  ({
    id,
    parentId,
    nameAr: `منصب ${id}`,
    nameEn: `Position ${id}`,
    sortOrder: 0,
    ...extra,
  }) as ContentRow;

// 1 ─┬─ 2 ── 4
//    └─ 3        (3 sorted before 2)
const rows = [
  row('1', null),
  row('2', '1', { sortOrder: 2 }),
  row('3', '1', { sortOrder: 1 }),
  row('4', '2'),
];

describe('org-tree', () => {
  it('flattens depth-first with siblings in sort order', () => {
    expect(flattenTree(rows).map(({ row, depth }) => [row.id, depth])).toEqual([
      ['1', 0],
      ['3', 1],
      ['2', 1],
      ['4', 2],
    ]);
  });

  it('shows a row whose parent is missing at the top level', () => {
    expect(flattenTree([row('9', '404')]).map(({ depth }) => depth)).toEqual([0]);
  });

  it('offers every position but the edited one and its sub-positions, indented', () => {
    expect(parentOptions(rows, '2')).toEqual([
      { value: '1', label: 'منصب 1' },
      { value: '3', label: '— منصب 3' },
    ]);
    expect(parentOptions(rows, null).map((o) => o.value)).toEqual(['1', '3', '2', '4']);
  });

  it('builds the preview with the API rules', () => {
    const forest = previewForest(
      [
        ...rows,
        row('5', '1', { isPublished: false }),
        row('6', '5'),
        row('7', null, { showHolders: false }),
      ],
      [
        { id: '10', nameAr: 'عضو', nameEn: 'Member', orgPositionId: '3' } as ContentRow,
        { id: '11', nameAr: 'مسودة', orgPositionId: '3', isPublished: false } as ContentRow,
        { id: '12', nameAr: 'مخفي', orgPositionId: '7' } as ContentRow,
      ],
      'en',
    );
    expect(forest.map((n) => n.id)).toEqual(['1', '7']); // 5 (and 6 under it) hidden
    expect(forest[0].children.map((n) => [n.id, n.tone])).toEqual([
      ['3', 'sky'],
      ['2', 'sky'],
    ]);
    expect(forest[0].children[0].holders).toEqual([{ id: '10', name: 'Member' }]);
    expect(forest[0].children[1].children[0]).toMatchObject({
      id: '4',
      tone: 'green',
      name: 'Position 4',
    });
    expect(forest[1].holders).toEqual([]);
  });

  it('resolves auto tones by depth', () => {
    expect([0, 1, 2, 3, 4].map((d) => resolveTone('auto', d))).toEqual([
      'neutral',
      'sky',
      'green',
      'brand',
      'brand',
    ]);
    expect(resolveTone('green', 0)).toBe('green');
  });
});
