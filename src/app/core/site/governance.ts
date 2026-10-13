import type { DocSection } from '../api/models';

/** The first governance section: `/governance` lands here. */
export const DEFAULT_GOVERNANCE_SECTION = 'bylaws-policies';

/** The bylaws section also shows the association's licence details (site settings). */
export const LICENCE_DETAILS_SECTION = 'bylaws-policies';

/** Locale-agnostic paths of the governance pages (prefix with `LocaleService.link()`). */
export const GOVERNANCE_PATHS = {
  root: '/governance',
  licences: '/governance/licences',
  board: '/board',
  section: (slug: string) => `/governance/${slug}`,
} as const;

/** One entry of a governance menu (header dropdown, drawer group, footer, the pages' own nav). */
export interface GovernanceLink {
  /** Section slug, or `licences` / `board`. */
  key: string;
  /** API name (sections) or a translation key (`labelKey`) for the fixed entries. */
  label: string | null;
  labelKey: string | null;
  path: string;
}

/**
 * The governance menu: the published sections from `GET /documents/sections` (API order), then
 * Licences and the board page. With `board: false` the board entry is left out (the footer has its
 * own board link).
 */
export function governanceLinks(
  sections: readonly DocSection[],
  { board = true }: { board?: boolean } = {},
): GovernanceLink[] {
  const links: GovernanceLink[] = sections
    .filter((s) => s.sectionGroup === 'governance' && s.slug !== 'licences')
    .map((s) => ({
      key: s.slug,
      label: s.name,
      labelKey: null,
      path: GOVERNANCE_PATHS.section(s.slug),
    }));
  links.push({
    key: 'licences',
    label: null,
    labelKey: 'pages.governance.licences',
    path: GOVERNANCE_PATHS.licences,
  });
  if (board) {
    links.push({
      key: 'board',
      label: null,
      labelKey: 'pages.governance.board',
      path: GOVERNANCE_PATHS.board,
    });
  }
  return links;
}

/**
 * Old `/documents?category=<slug>` links → their governance page (W5). The API renamed two
 * categories (policies-regulations → bylaws-policies, meeting-minutes → general-assembly) and moved
 * licences to their own table and page.
 */
export const LEGACY_DOCUMENT_CATEGORIES: Readonly<Record<string, string>> = {
  'policies-regulations': GOVERNANCE_PATHS.section('bylaws-policies'),
  'meeting-minutes': GOVERNANCE_PATHS.section('general-assembly'),
  'annual-reports': GOVERNANCE_PATHS.section('annual-reports'),
  licences: GOVERNANCE_PATHS.licences,
};

/** `/documents` (with or without `?category=`) → the matching governance path. */
export function legacyDocumentsPath(category: string | null | undefined): string {
  if (!category) return GOVERNANCE_PATHS.root;
  return (
    LEGACY_DOCUMENT_CATEGORIES[category] ??
    (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)
      ? GOVERNANCE_PATHS.section(category)
      : GOVERNANCE_PATHS.root)
  );
}

/** Today's calendar date in Riyadh (`YYYY-MM-DD`), for the licence valid/expired status. */
export function riyadhToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(now);
}

/** A licence is expired once its expiry date is before today (it is still valid on that day). */
export function licenceStatus(
  expiresOn: string | null | undefined,
  today: string,
): 'valid' | 'expired' | null {
  if (!expiresOn) return null;
  return expiresOn.slice(0, 10) < today ? 'expired' : 'valid';
}
