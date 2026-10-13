import { stackLeaves } from './org-chart.layout';

const leaf = { children: [] };
const branch = { children: [leaf] };

describe('stackLeaves', () => {
  it('stacks consecutive leaves in one column and gives each branch its own', () => {
    const row = stackLeaves([leaf, leaf, branch, leaf]);
    expect(row.slots.map((s) => [s.col, s.row])).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
      [3, 1],
    ]);
    expect(row.columns).toBe(3);
    expect(row.rows).toBe(2);
    expect(row.slots.map((s) => s.branch)).toEqual([false, false, true, false]);
    expect(row.slots.map((s) => s.stacked)).toEqual([false, true, false, false]);
  });

  it('marks the first and last columns', () => {
    const row = stackLeaves([branch, leaf, branch]);
    expect(row.slots.map((s) => [s.firstCol, s.lastCol])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
  });

  it('handles an empty row', () => {
    expect(stackLeaves([])).toEqual({ slots: [], columns: 0, rows: 0 });
  });
});
