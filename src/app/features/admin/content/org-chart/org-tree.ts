import type { ContentRow } from '../../../../core/api/admin/content-api';
import type { OrgNode, OrgTone } from '../../../../core/api/models';
import { pick } from '../crud/crud-config';

/** The API's depth cap (org-chart/tree-guard.ts): at most five levels. */
export const ORG_MAX_DEPTH = 5;

const BY_DEPTH: readonly OrgTone[] = ['neutral', 'sky', 'green', 'brand'];

/** `auto` → by depth: 0 neutral, 1 sky, 2 green, 3+ brand; an explicit tone is kept (API rule). */
export function resolveTone(tone: unknown, depth: number): OrgTone {
  return tone && tone !== 'auto'
    ? (tone as OrgTone)
    : BY_DEPTH[Math.min(depth, BY_DEPTH.length - 1)];
}

function parentOf(row: ContentRow): string | null {
  const p = row['parentId'];
  return p === null || p === undefined || p === '' ? null : String(p);
}

function bySort(a: ContentRow, b: ContentRow): number {
  return Number(a['sortOrder'] ?? 0) - Number(b['sortOrder'] ?? 0) || Number(a.id) - Number(b.id);
}

/**
 * Depth-first order of every position (siblings by `sortOrder`), each with its depth. A row whose
 * parent is missing from the list is shown at the top level, so nothing is ever unreachable.
 */
export function flattenTree(rows: readonly ContentRow[]): { row: ContentRow; depth: number }[] {
  const ids = new Set(rows.map((r) => String(r.id)));
  const children = new Map<string | null, ContentRow[]>();
  for (const r of rows) {
    const parent = parentOf(r);
    const key = parent !== null && ids.has(parent) ? parent : null;
    children.set(key, [...(children.get(key) ?? []), r]);
  }
  for (const list of children.values()) list.sort(bySort);
  const out: { row: ContentRow; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number): void => {
    for (const row of children.get(parent) ?? []) {
      if (seen.has(String(row.id))) continue;
      seen.add(String(row.id));
      out.push({ row, depth });
      walk(String(row.id), depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** The id itself plus every id below it — what a "reports to" select must not offer. */
export function selfAndDescendants(rows: readonly ContentRow[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows) {
      const parent = parentOf(r);
      if (parent && out.has(parent) && !out.has(String(r.id))) {
        out.add(String(r.id));
        grew = true;
      }
    }
  }
  return out;
}

/**
 * «يرفع إلى» options: the tree in order, indented by depth, without the edited position and its
 * sub-positions (the API refuses a cycle anyway; this keeps the editor from trying).
 */
export function parentOptions(
  rows: readonly ContentRow[],
  rowId: string | null,
): { value: string; label: string }[] {
  const excluded = rowId ? selfAndDescendants(rows, rowId) : new Set<string>();
  return flattenTree(rows)
    .filter(({ row }) => !excluded.has(String(row.id)))
    .map(({ row, depth }) => ({
      value: String(row.id),
      label: `${'— '.repeat(depth)}${pick(row, 'name', 'ar')}`,
    }));
}

/**
 * The dashboard's live preview, built with the same rules as `GET /org-chart`: published positions
 * only (a branch under an unpublished one is hidden), `auto` tones by depth, holders (published
 * members linked to the position) only where the position shows them.
 */
export function previewForest(
  rows: readonly ContentRow[],
  members: readonly ContentRow[],
  lang: 'ar' | 'en',
): OrgNode[] {
  const visible = rows.filter((r) => r['isPublished'] !== false);
  const ids = new Set(visible.map((r) => String(r.id)));
  const children = new Map<string | null, ContentRow[]>();
  for (const r of visible) {
    const parent = parentOf(r);
    if (parent !== null && !ids.has(parent)) continue;
    children.set(parent, [...(children.get(parent) ?? []), r]);
  }
  for (const list of children.values()) list.sort(bySort);
  const holders = new Map<string, { id: string; name: string }[]>();
  for (const m of members) {
    const position = m['orgPositionId'];
    if (m['isPublished'] === false || position === null || position === undefined) continue;
    const key = String(position);
    holders.set(key, [
      ...(holders.get(key) ?? []),
      { id: String(m.id), name: pick(m, 'name', lang) },
    ]);
  }
  const build = (parent: string | null, depth: number): OrgNode[] =>
    depth >= ORG_MAX_DEPTH
      ? []
      : (children.get(parent) ?? []).map((r) => ({
          id: String(r.id),
          name: pick(r, 'name', lang),
          tone: resolveTone(r['tone'], depth),
          holders: r['showHolders'] === false ? [] : (holders.get(String(r.id)) ?? []),
          children: build(String(r.id), depth + 1),
        }));
  return build(null, 0);
}
