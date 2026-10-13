/** Where one position sits among its siblings in the stacked layout. Columns and rows are 1-based. */
export interface ChartSlot {
  col: number;
  /** For a branch: 1, and it spans every row (org-chart.css). For a stacked leaf: its place in the stack. */
  row: number;
  /** A position with sub-positions: its subtree spreads below it instead of stacking. */
  branch: boolean;
  firstCol: boolean;
  lastCol: boolean;
  /** Row 2 and below: hangs from the box above, not from the sibling bar. */
  stacked: boolean;
}

export interface ChartRow {
  slots: ChartSlot[];
  columns: number;
  /** The tallest stack. */
  rows: number;
}

/**
 * The stacked layout (org-chart.ts level 1), ported from ta3lom: a row of siblings where every run
 * of CONSECUTIVE leaves (positions with no sub-positions) shares one column, one box under another,
 * while each position that has children gets a column of its own. Order is kept. This lets a wide
 * tree stay root → children instead of dropping to the vertical list.
 *
 * Every position stays its own `<li>` in its parent's `<ul>` — only the grid placement changes —
 * so what a screen reader walks is the same tree in every layout.
 */
export function stackLeaves(nodes: readonly { children: readonly unknown[] }[]): ChartRow {
  const slots: ChartSlot[] = [];
  let col = 0;
  let row = 0;
  let rows = 0;
  let previousWasLeaf = false;

  for (const node of nodes) {
    const branch = node.children.length > 0;
    if (branch || !previousWasLeaf) {
      col += 1;
      row = 0;
    }
    row += 1;
    rows = Math.max(rows, row);
    slots.push({ col, row, branch, firstCol: col === 1, lastCol: false, stacked: row > 1 });
    previousWasLeaf = !branch;
  }

  for (const slot of slots) slot.lastCol = slot.col === col;
  return { slots, columns: col, rows };
}
